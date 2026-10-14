/**
 * Стаж и интервалы: обработка present и подсчёт стажа.
 *
 * См. docs/superpowers/specs/SPEC-dates.md разделы 2, 6, 7.
 */

import type { InclusiveInterval, YearMonth } from "./dates";
import { monthsInclusive, toMonths } from "./dates";

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
