/**
 * Проверка чисел слоя 1: токенизация, исключения, сверка с фактами.
 *
 * Выделено из verification.ts (лимит 250 строк).
 * См. docs/superpowers/specs/SPEC-verification.md, раздел 2.
 */

import type { Currency, NumberQualifier } from "./numbers";
import { parseNumber } from "./numbers";

/** Итог проверки одного числа из текста резюме. */
export interface NumberCheckResult {
  number: string;
  found: boolean;
  factId: string | null;
  reason: string;
}

/** Число факта для сверки: значение, валюта, характер, роли. */
export interface FactNumber {
  factId: string;
  value: number;
  currency: Currency | null;
  qualifier: NumberQualifier;
  roles: string[];
}

/**
 * Делит числовые токены на проверяемые и исключения.
 *
 * Исключения: телефоны +7, версии вида v1, годы 1990-2030 без единиц,
 * номера маркированных списков ("1. ", "2) " в начале строки).
 * Валюта после числа (руб, USD, %) входит в токен для сверки.
 *
 * @param text - проверяемый текст
 * @returns проверяемые токены и строки исключений
 */
function collectTokens(text: string): { kept: string[]; excluded: string[] } {
  const kept: string[] = [];
  const excluded: string[] = [];
  const corePattern = /-?\d(?:[\d\s\u00A0\u202F]*\d)?(?:[.,]\d+)?/g;
  const magnitudePattern =
    "миллиард\\w*|млрд\\.?|миллион\\w*|млн\\.?|тысяч\\w*|тысяча|тыс\\.?|billion\\w*|million\\w*|mln\\.?" +
    "|thousand\\w*|k\\b|%";
  const currencyPattern = "руб\\.?|rub|\\$|usd|доллар\\w*|€|eur|евро\\w*";
  const unitPattern = new RegExp(
    `^\\s*(?:${magnitudePattern})(?:\\s*(?:${currencyPattern}))?|^\\s*(?:${currencyPattern})`,
    "i",
  );
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
 * Возвращает строки исключений (телефоны, годы, версии).
 *
 * @param text - проверяемый текст
 * @returns строки исключений
 */
export function collectExcluded(text: string): string[] {
  return collectTokens(text).excluded;
}

/**
 * Проверяет, процентный ли характер числа.
 *
 * @param qualifier - характер числа
 * @returns true для percent и approx-percent
 */
function isPercentKind(qualifier: NumberQualifier): boolean {
  return qualifier === "percent" || qualifier === "approx-percent";
}

/**
 * Сверяет одно число с фактами: значение, характер, валюта, роль.
 *
 * Порядок фильтров: value -> qualifier -> currency -> roles.
 * Несовпадение валют, заданных с обеих сторон, и разный характер
 * (процент против exact) — жёсткая несверка. Валюта, заданная
 * с одной стороны, и различающиеся уточнения одного характера —
 * warning, не hard.
 *
 * @param token - числовой токен из текста
 * @param factsNumbers - числа фактов
 * @param roleId - целевая роль
 * @returns итог проверки токена
 */
function checkToken(token: string, factsNumbers: FactNumber[], roleId: string): NumberCheckResult {
  const parsed = parseNumber(token);

  if (parsed === null) {
    return { number: token, found: false, factId: null, reason: "число не распознано" };
  }

  const byValue = factsNumbers.filter((entry) => entry.value === parsed.value);

  if (byValue.length === 0) {
    return { number: token, found: false, factId: null, reason: "unsupported_number: числа нет в facts.json" };
  }

  const byQualifier = byValue.filter((entry) => isPercentKind(entry.qualifier) === isPercentKind(parsed.qualifier));

  if (byQualifier.length === 0) {
    const first = byValue[0] as FactNumber;

    return {
      number: token,
      found: false,
      factId: first.factId,
      reason: "qualifier_mismatch: характер числа не совпадает с фактом",
    };
  }

  return checkCurrencyAndRole(token, byQualifier, parsed.currency, parsed.qualifier, roleId);
}

/**
 * Сверяет каждое число текста с фактами и ролью.
 *
 * Число обязано совпасть по значению, характеру и валюте
 * с factsNumbers, а факт обязан содержать roleId в roles.
 * Возвращает результат по каждому токену, включая совпавшие.
 *
 * @param text - текст резюме
 * @param factsNumbers - числа фактов с валютой, характером и ролями
 * @param roleId - целевая роль
 * @returns результаты проверки по каждому числу
 */
export function verifyNumbers(text: string, factsNumbers: FactNumber[], roleId: string): NumberCheckResult[] {
  return extractNumbers(text).map((token) => checkToken(token, factsNumbers, roleId));
}

/**
 * Сверяет кандидатов по валюте и роли, собирает warnings.
 *
 * @param token - числовой токен из текста
 * @param candidates - факты, совпавшие по значению и характеру
 * @param currency - валюта токена или null
 * @param qualifier - характер токена
 * @param roleId - целевая роль
 * @returns итог проверки токена
 */
function checkCurrencyAndRole(
  token: string,
  candidates: FactNumber[],
  currency: Currency | null,
  qualifier: NumberQualifier,
  roleId: string,
): NumberCheckResult {
  const byCurrency = candidates.filter(
    (entry) => entry.currency === null || currency === null || entry.currency === currency,
  );

  if (byCurrency.length === 0) {
    const first = candidates[0] as FactNumber;

    return {
      number: token,
      found: false,
      factId: first.factId,
      reason: `currency_mismatch: валюта факта ${first.currency ?? "не указана"}`,
    };
  }

  const byRole = byCurrency.filter((entry) => entry.roles.includes(roleId));

  if (byRole.length === 0) {
    const first = byCurrency[0] as FactNumber;

    return {
      number: token,
      found: false,
      factId: first.factId,
      reason: `wrong_role: число не для роли "${roleId}"`,
    };
  }

  const fact = byRole[0] as FactNumber;
  const warnings: string[] = [];

  if (fact.qualifier !== qualifier) {
    warnings.push("возможно округление: характер числа отличается от факта");
  }

  if ((fact.currency === null) !== (currency === null)) {
    warnings.push("валюта указана с одной стороны");
  }

  return {
    number: token,
    found: true,
    factId: fact.factId,
    reason: warnings.length > 0 ? warnings.join("; ") : "число совпадает с фактом",
  };
}
