/**
 * Стаж и интервалы: обработка present, разрывы, пересечения.
 *
 * См. docs/superpowers/specs/SPEC-dates.md разделы 2, 6, 7.
 */

import type { InclusiveInterval, YearMonth } from "./dates";
import { fromMonths, monthsInclusive, toMonths } from "./dates";

/** Работа в терминах дат. */
export interface JobInterval {
  id: string;
  start: YearMonth;
  /** Может быть null, если isCurrent = true. */
  end: YearMonth | null;
  isCurrent: boolean;
  /** Группа для параллельных ролей. null, если роль одна. */
  overlapGroup: string | null;
}

/** Интервал с разрешённым концом (present -> последний завершённый месяц). */
export interface ResolvedInterval extends InclusiveInterval {
  id: string;
  overlapGroup: string | null;
}

/** Разрыв между двумя работами. */
export interface Gap {
  fromJobId: string;
  toJobId: string;
  /** Месяцев между концом первого и началом второго, не включая ни один. */
  months: number;
  fromEnd: YearMonth;
  toStart: YearMonth;
}

/** Пересечение двух работ из разных overlap_group. */
export interface Overlap {
  jobIdA: string;
  jobIdB: string;
  months: number;
}

/**
 * Возвращает последний завершённый месяц относительно auditDate.
 *
 * Если auditDate = 2026-10-09, present = сентябрь 2026.
 *
 * @param auditDate - дата аудита в формате YYYY-MM-DD
 * @returns последний завершённый месяц
 */
export function resolvePresent(auditDate: string): YearMonth {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(auditDate);

  if (!match) {
    throw new Error(`Invalid auditDate: "${auditDate}". Expected YYYY-MM-DD.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month === 1) {
    return { year: year - 1, month: 12 };
  }

  return { year, month: month - 1 };
}

/**
 * Разрешает конец интервала: present -> последний завершённый месяц.
 *
 * @param job - работа с возможным isCurrent
 * @param present - последний завершённый месяц
 * @returns интервал с разрешённым концом
 */
export function resolveJobEnd(job: JobInterval, present: YearMonth): ResolvedInterval {
  const end = job.isCurrent ? present : job.end;

  if (!end) {
    throw new Error(`Job "${job.id}" has isCurrent=false and end=null.`);
  }

  return {
    id: job.id,
    start: job.start,
    end,
    overlapGroup: job.overlapGroup,
  };
}

/**
 * Находит разрывы больше указанного порога между последовательными работами.
 *
 * Работы сортируются по началу. Стык (prev.end == next.start) не разрыв.
 * Разрыв ровно threshold месяцев не флагуется, строго больше — флагуется.
 *
 * @param intervals - разрешённые интервалы
 * @param threshold - порог в месяцах (по умолчанию 3)
 * @returns список разрывов
 */
export function findGaps(intervals: ResolvedInterval[], threshold = 3): Gap[] {
  if (intervals.length < 2) {
    return [];
  }

  const sorted = [...intervals].sort((a, b) => toMonths(a.start) - toMonths(b.start));

  const gaps: Gap[] = [];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const next = sorted[i];

    if (!prev || !next) {
      continue;
    }

    const prevEnd = toMonths(prev.end);
    const nextStart = toMonths(next.start);
    const gapMonths = nextStart - prevEnd - 1;

    if (gapMonths > threshold) {
      gaps.push({
        fromJobId: prev.id,
        toJobId: next.id,
        months: gapMonths,
        fromEnd: prev.end,
        toStart: next.start,
      });
    }
  }

  return gaps;
}

/**
 * Находит пересечения между работами из разных overlap_group.
 *
 * Смежность (prev.end == next.start) не пересечение.
 *
 * @param intervals - разрешённые интервалы
 * @returns список пересечений
 */
export function findOverlaps(intervals: ResolvedInterval[]): Overlap[] {
  const overlaps: Overlap[] = [];

  for (let i = 0; i < intervals.length; i += 1) {
    for (let j = i + 1; j < intervals.length; j += 1) {
      const a = intervals[i];
      const b = intervals[j];

      if (!a || !b) {
        continue;
      }

      if (a.overlapGroup !== null && a.overlapGroup === b.overlapGroup) {
        continue;
      }

      const aStart = toMonths(a.start);
      const aEnd = toMonths(a.end);
      const bStart = toMonths(b.start);
      const bEnd = toMonths(b.end);

      // Смежность: конец одного совпадает с началом другого.
      // Это не пересечение, а нормальная последовательность.
      if (aEnd === bStart || bEnd === aStart) {
        continue;
      }

      const overlapStart = Math.max(aStart, bStart);
      const overlapEnd = Math.min(aEnd, bEnd);

      if (overlapStart <= overlapEnd) {
        overlaps.push({
          jobIdA: a.id,
          jobIdB: b.id,
          months: overlapEnd - overlapStart + 1,
        });
      }
    }
  }

  return overlaps;
}

/**
 * Считает стаж двумя способами: наивная сумма и объединение.
 *
 * @param intervals - разрешённые интервалы
 * @returns обе величины и разницу
 */
export function computeExperience(intervals: ResolvedInterval[]): {
  naive: number;
  distinct: number;
  difference: number;
} {
  const naive = intervals.reduce((sum, i) => sum + monthsInclusive(i.start, i.end), 0);

  const halfOpen = intervals.map((i) => ({
    start: toMonths(i.start),
    end: toMonths(i.end) + 1,
  }));

  const sorted = [...halfOpen].sort((a, b) => a.start - b.start);
  let distinct = 0;
  let currentStart = 0;
  let currentEnd = 0;
  let initialized = false;

  for (const interval of sorted) {
    if (!initialized) {
      currentStart = interval.start;
      currentEnd = interval.end;
      initialized = true;
      continue;
    }

    if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end);
    } else {
      distinct += currentEnd - currentStart;
      currentStart = interval.start;
      currentEnd = interval.end;
    }
  }

  if (initialized) {
    distinct += currentEnd - currentStart;
  }

  return { naive, distinct, difference: naive - distinct };
}

/**
 * Форматирует число месяцев в вид "N лет M месяцев".
 *
 * @param months - число месяцев
 * @returns строка вида "21 год 10 месяцев"
 */
export function formatExperience(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;

  return `${years} ${pluralYears(years)} ${rest} ${pluralMonths(rest)}`;
}

/**
 * Склонение слова "год".
 *
 * @param n - число лет
 * @returns "год" | "года" | "лет"
 */
function pluralYears(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod10 === 1 && mod100 !== 11) return "год";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "года";
  return "лет";
}

/**
 * Склонение слова "месяц".
 *
 * @param n - число месяцев
 * @returns "месяц" | "месяца" | "месяцев"
 */
function pluralMonths(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod10 === 1 && mod100 !== 11) return "месяц";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "месяца";
  return "месяцев";
}

/**
 * Заглушка для совместимости с другими модулями.
 *
 * @param months - число месяцев
 * @returns YearMonth
 */
export function monthsToYearMonth(months: number): YearMonth {
  return fromMonths(months);
}
