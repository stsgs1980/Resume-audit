/**
 * Слой 1 верификации: детерминированные проверки перед экспортом.
 *
 * См. docs/superpowers/specs/SPEC-verification.md, раздел 2.
 * Тестов 21 (XSS) и 22 (path traversal) здесь нет: они относятся
 * к server и ui.
 */

import { detectForbiddenWords } from "./detectors";
import type { FactNumber, NumberCheckResult } from "./number-check";
import { collectExcluded, verifyNumbers } from "./number-check";
import { normalizeText } from "./skills";

/** Входные данные сквозной проверки. */
export interface VerificationContext {
  resumeText: string;
  factsNumbers: FactNumber[];
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
  const exceptions = collectExcluded(context.resumeText);
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
