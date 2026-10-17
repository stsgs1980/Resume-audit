/**
 * Стаж и интервалы: обработка present и подсчёт стажа.
 *
 * См. docs/superpowers/specs/SPEC-dates.md разделы 2, 6, 7.
 */

import type { InclusiveInterval, YearMonth } from "./dates";
import { naiveSum, toHalfOpen, unionLength } from "./dates";

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
 * Делегирует в naiveSum и unionLength из dates.ts.
 *
 * @param intervals - разрешённые интервалы
 * @returns обе величины и разницу
 */
export function computeExperience(intervals: ResolvedInterval[]): {
  naive: number;
  distinct: number;
  difference: number;
} {
  const naive = naiveSum(intervals);
  const halfOpen = intervals.map((interval) => toHalfOpen(interval));
  const distinct = unionLength(halfOpen);

  return { naive, distinct, difference: naive - distinct };
}
