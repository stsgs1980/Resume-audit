import type { YearMonth } from "../../core/dates";
import { monthsInclusive, parseYearMonth } from "../../core/dates";
import type { ResolvedInterval } from "../../core/experience";
import { resolvePresent } from "../../core/experience";
import { findGaps } from "../../core/interval-analysis";
import { detectClaimCompany } from "./company";
import type { Claim, Contradiction, OpenQuestion } from "./types";

/** Даты вида YYYY-MM в тексте. */
const DATE_PATTERN = /\b(19|20)\d{2}-(0[1-9]|1[0-2])\b/g;

/** Длительность вида "2 года 3 месяца" или "13 месяцев". */
const DURATION_PATTERN = /(\d+)\s*(?:год[а-я]*|лет)?\s*(\d+)?\s*мес/i;

/**
 * Извлекает все даты YYYY-MM из цитаты и формулировки.
 *
 * @param claim - утверждение
 * @returns даты по порядку упоминания
 */
function extractDates(claim: Claim): YearMonth[] {
  const found = `${claim.quote} ${claim.statement}`.match(DATE_PATTERN) ?? [];

  return found.map((date) => parseYearMonth(date));
}

/**
 * Строит интервалы employment-утверждений для анализа дат.
 *
 * @param claims - утверждения этапа 2
 * @returns интервалы (конец по умолчанию равен началу)
 */
export function extractEmploymentIntervals(claims: Claim[]): ResolvedInterval[] {
  const intervals: ResolvedInterval[] = [];

  for (const claim of claims) {
    if (claim.category !== "employment") {
      continue;
    }

    const dates = extractDates(claim);

    if (dates.length === 0) {
      continue;
    }

    const start = dates[0] as YearMonth;
    const end = (dates[dates.length - 1] ?? start) as YearMonth;

    intervals.push({ id: claim.id, start, end, overlapGroup: null });
  }

  return intervals;
}

/**
 * Ищет пары employment-утверждений одной компании с разными датами.
 * Компания извлекается из текста явно; утверждения без компании
 * не участвуют — общие слова компанией не считаются.
 *
 * @param claims - утверждения этапа 2
 * @returns противоречия вида date_mismatch
 */
export function detectDateContradictions(claims: Claim[]): Contradiction[] {
  const dated = claims.filter((claim) => claim.category === "employment" && extractDates(claim).length > 0);
  const byCompany = new Map<string, Claim[]>();

  for (const claim of dated) {
    const company = detectClaimCompany(claim);

    if (company === null) {
      continue;
    }

    const key = company.toLowerCase();
    const group = byCompany.get(key) ?? [];

    group.push(claim);
    byCompany.set(key, group);
  }

  const contradictions: Contradiction[] = [];

  for (const group of byCompany.values()) {
    for (let index = 0; index < group.length; index += 1) {
      for (let other = index + 1; other < group.length; other += 1) {
        const first = group[index] as Claim;
        const second = group[other] as Claim;
        const firstDates = extractDates(first).map((date) => `${date.year}-${date.month}`);
        const secondDates = extractDates(second).map((date) => `${date.year}-${date.month}`);

        if (firstDates.join() === secondDates.join()) {
          continue;
        }

        contradictions.push({
          id: "",
          kind: "date_mismatch",
          severity: "warning",
          factIds: [first.id, second.id],
          description: `Разные даты одного места работы: ${firstDates.join(", ")} против ${secondDates.join(", ")}`,
          evidence: [first.quote, second.quote],
        });
      }
    }
  }

  return contradictions;
}

/**
 * Парсит заявленную длительность из текста ("13 месяцев", "2 года 3 месяца").
 *
 * @param text - цитата утверждения
 * @returns месяцев или null
 */
function parseStatedMonths(text: string): number | null {
  const match = DURATION_PATTERN.exec(text);

  if (match === null || match[1] === undefined) {
    return null;
  }

  const first = Number(match[1]);
  const second = match[2] === undefined || match[2] === "" ? 0 : Number(match[2]);

  if (/год|лет/i.test(text)) {
    return first * 12 + second;
  }

  return first;
}

/**
 * Сверяет заявленную длительность с расчётной по датам.
 * Расхождение в 1 месяц и больше — hard (тест: 13 против 12).
 *
 * @param claims - утверждения этапа 2
 * @param auditDate - дата аудита для открытых интервалов
 * @returns противоречия вида duration_mismatch
 */
export function detectDurationMismatch(claims: Claim[], auditDate: string): Contradiction[] {
  const contradictions: Contradiction[] = [];

  for (const claim of claims) {
    if (claim.category !== "employment") {
      continue;
    }

    const dates = extractDates(claim);
    const stated = parseStatedMonths(claim.quote);

    if (dates.length === 0 || stated === null) {
      continue;
    }

    const start = dates[0] as YearMonth;
    const end = dates.length > 1 ? (dates[dates.length - 1] as YearMonth) : resolvePresent(auditDate);
    const actual = monthsInclusive(start, end);

    if (Math.abs(stated - actual) >= 1) {
      contradictions.push({
        id: "",
        kind: "duration_mismatch",
        severity: "hard",
        factIds: [claim.id],
        description: `Заявлено ${stated} мес., по датам ${actual} мес.`,
        evidence: [claim.quote],
      });
    }
  }

  return contradictions;
}

/**
 * Ищет разрывы между работами через findGaps с порогом 3.
 *
 * @param claims - утверждения этапа 2
 * @returns вопросы типа gap
 */
export function detectGaps(claims: Claim[]): OpenQuestion[] {
  return findGaps(extractEmploymentIntervals(claims), 3).map((gap) => ({
    id: "",
    type: "gap" as const,
    question: `Разрыв ${gap.months} мес. между работами: чем он объясняется?`,
    context: `${gap.fromEnd.year}-${gap.fromEnd.month} -> ${gap.toStart.year}-${gap.toStart.month}`,
    relatedClaimIds: [gap.fromJobId, gap.toJobId],
    createdFrom: "audit#gap",
  }));
}
