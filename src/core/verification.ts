/**
 * Слой 1 верификации: детерминированные проверки перед экспортом.
 *
 * См. docs/superpowers/specs/SPEC-verification.md, раздел 2.
 * Тестов 21 (XSS) и 22 (path traversal) здесь нет: они относятся
 * к server и ui.
 */

import { detectForbiddenWords } from "./detectors";
import { parseNumber } from "./numbers";
import { normalizeText } from "./skills";

/** Итог проверки одного числа из текста резюме. */
export interface NumberCheckResult {
  number: string;
  found: boolean;
  factId: string | null;
  reason: string;
}

/** Входные данные сквозной проверки. */
export interface VerificationContext {
  resumeText: string;
  factsNumbers: Array<{ factId: string; value: number; roles: string[] }>;
  resumeSkills: string[];
  confirmedSkills: Array<{ skill: string; roles: string[] }>;
  roleId: string;
  forbiddenWords: string[];
  hedgeRequiredFactIds: string[];
  factIdsWithHedge: string[];
  requiredFields: Record<string, string | null | undefined>;
  targetShares: number[];
}

/** Итог сквозной проверки. */
export interface VerificationResult {
  ok: boolean;
  numberErrors: NumberCheckResult[];
  skillErrors: string[];
  forbiddenFound: string[];
  hedgeErrors: string[];
  missingFields: string[];
  shareSumOk: boolean;
  exceptions: string[];
}

/**
 * Делит числовые токены на проверяемые и исключения.
 *
 * Исключения: телефоны +7, версии вида v1, годы 1990-2030 без единиц,
 * номера маркированных списков ("1. ", "2) " в начале строки).
 *
 * @param text - проверяемый текст
 * @returns проверяемые токены и строки исключений
 */
function collectTokens(text: string): { kept: string[]; excluded: string[] } {
  const kept: string[] = [];
  const excluded: string[] = [];
  const corePattern = /-?\d(?:[\d\s\u00A0\u202F]*\d)?(?:[.,]\d+)?/g;
  const unitPattern =
    /^\s*(миллиард\w*|млрд\.?|миллион\w*|млн\.?|тысяч\w*|тысяча|тыс\.?|billion\w*|million\w*|mln\.?|thousand\w*|k\b|%)/i;
  const masked = text
    .replace(/\+7(?:[\s()-]*\d){10,}/g, (match) => {
      excluded.push(match);
      return " ".repeat(match.length);
    })
    .replace(/\bv\d+(?:\.\d+)*/gi, (match) => {
      excluded.push(match);
      return " ".repeat(match.length);
    });

  let match: RegExpExecArray | null;

  while ((match = corePattern.exec(masked)) !== null) {
    const core = match[0];
    const unit = unitPattern.exec(masked.slice(match.index + core.length));
    const token = (core + (unit ? unit[0] : "")).trim();
    const digitsOnly = core.replace(/[\s\u00A0\u202F]/g, "");
    const end = match.index + core.length + (unit ? unit[0].length : 0);
    const nextChar = masked[end] ?? "";
    const lineStart = masked.lastIndexOf("\n", match.index - 1) + 1;
    const before = masked.slice(lineStart, match.index);
    const asYear = Number(digitsOnly);
    const isYear = unit === null && /^\d{4}$/.test(digitsOnly) && asYear >= 1990 && asYear <= 2030;
    const isListItem =
      unit === null && /^\d+$/.test(digitsOnly) && /^\s*$/.test(before) && (nextChar === "." || nextChar === ")");

    if (isYear || isListItem) {
      excluded.push(token);
    } else {
      kept.push(token);
    }
  }

  return { kept, excluded };
}

/**
 * Извлекает числовые токены из текста резюме.
 *
 * Исключения (годы, телефоны, версии, номера списков) не возвращаются.
 *
 * @param text - текст резюме
 * @returns список числовых токенов
 */
export function extractNumbers(text: string): string[] {
  return collectTokens(text).kept;
}

/**
 * Сверяет каждое число текста с фактами и ролью.
 *
 * Число обязано совпасть по значению с factsNumbers, а факт обязан
 * содержать roleId в roles. Возвращает результат по каждому токену,
 * включая совпавшие (found: true).
 *
 * @param text - текст резюме
 * @param factsNumbers - числа фактов с ролями
 * @param roleId - целевая роль
 * @returns результаты проверки по каждому числу
 */
export function verifyNumbers(
  text: string,
  factsNumbers: Array<{ factId: string; value: number; roles: string[] }>,
  roleId: string,
): NumberCheckResult[] {
  return extractNumbers(text).map((token) => {
    const parsed = parseNumber(token);

    if (parsed === null) {
      return { number: token, found: false, factId: null, reason: "число не распознано" };
    }

    const fact = factsNumbers.find((entry) => entry.value === parsed.value);

    if (!fact) {
      return { number: token, found: false, factId: null, reason: "числа нет в facts.json" };
    }

    if (!fact.roles.includes(roleId)) {
      return { number: token, found: false, factId: fact.factId, reason: `число не для роли "${roleId}"` };
    }

    return { number: token, found: true, factId: fact.factId, reason: "число совпадает с фактом" };
  });
}

/**
 * Проверяет навыки резюме по подтверждённым для роли.
 *
 * @param resumeSkills - навыки из резюме
 * @param confirmedSkills - подтверждённые навыки с ролями
 * @param roleId - целевая роль
 * @returns навыки без подтверждения для роли
 */
export function verifySkills(
  resumeSkills: string[],
  confirmedSkills: Array<{ skill: string; roles: string[] }>,
  roleId: string,
): string[] {
  return resumeSkills.filter((skill) => {
    const wanted = normalizeText(skill);

    return !confirmedSkills.some((entry) => normalizeText(entry.skill) === wanted && entry.roles.includes(roleId));
  });
}

/**
 * Проверяет оговорки для фактов с hedge_required.
 *
 * @param factIdsWithHedge - factId с найденной оговоркой
 * @param hedgeRequiredFactIds - factId с hedgeRequired = true
 * @returns factId без оговорки
 */
export function verifyHedge(factIdsWithHedge: string[], hedgeRequiredFactIds: string[]): string[] {
  return hedgeRequiredFactIds.filter((factId) => !factIdsWithHedge.includes(factId));
}

/**
 * Ищет запрещённые слова через detectForbiddenWords.
 *
 * @param text - проверяемый текст
 * @param words - слова из config/forbidden-words.json
 * @returns найденные слова
 */
export function verifyForbidden(text: string, words: string[]): string[] {
  return detectForbiddenWords(text, words);
}

/**
 * Проверяет обязательные поля hh.ru.
 *
 * @param fields - имя поля -> значение
 * @returns имена пустых полей
 */
export function verifyRequiredFields(fields: Record<string, string | null | undefined>): string[] {
  return Object.entries(fields)
    .filter(([, value]) => value === null || value === undefined || value.trim() === "")
    .map(([name]) => name);
}

/**
 * Проверяет сумму долей: обязана входить в [0.99, 1.01].
 *
 * @param shares - доли targetShares
 * @returns true, если сумма в допуске
 */
export function verifyShareSum(shares: number[]): boolean {
  const sum = shares.reduce((total, share) => total + share, 0);

  return sum >= 0.99 && sum <= 1.01;
}

/**
 * Сквозная проверка слоя 1: собирает все проверки.
 *
 * @param context - входные данные проверки
 * @returns итог: ok только если все списки пусты и сумма долей в допуске
 */
export function verify(context: VerificationContext): VerificationResult {
  const numberErrors = verifyNumbers(context.resumeText, context.factsNumbers, context.roleId).filter(
    (result) => !result.found,
  );
  const skillErrors = verifySkills(context.resumeSkills, context.confirmedSkills, context.roleId);
  const forbiddenFound = verifyForbidden(context.resumeText, context.forbiddenWords);
  const hedgeErrors = verifyHedge(context.factIdsWithHedge, context.hedgeRequiredFactIds);
  const missingFields = verifyRequiredFields(context.requiredFields);
  const shareSumOk = verifyShareSum(context.targetShares);
  const exceptions = collectTokens(context.resumeText).excluded;
  const ok =
    numberErrors.length === 0 &&
    skillErrors.length === 0 &&
    forbiddenFound.length === 0 &&
    hedgeErrors.length === 0 &&
    missingFields.length === 0 &&
    shareSumOk;

  return {
    ok,
    numberErrors,
    skillErrors,
    forbiddenFound,
    hedgeErrors,
    missingFields,
    shareSumOk,
    exceptions,
  };
}
