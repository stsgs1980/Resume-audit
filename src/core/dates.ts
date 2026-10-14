/**
 * Конвенция дат и стаж.
 *
 * Включительный подсчёт месяцев воспроизводит конвенцию hh.ru.
 * Слияние интервалов — полуоткрытые интервалы `[s, e+1)`.
 *
 * См. docs/superpowers/specs/SPEC-dates.md.
 */

/** Месяц в формате YYYY-MM. */
export interface YearMonth {
  year: number;
  /** 1–12. */
  month: number;
}

/** Интервал с включительным концом. */
export interface InclusiveInterval {
  start: YearMonth;
  end: YearMonth;
}

/** Полуоткрытый интервал в месяцах от условного нуля. */
export interface HalfOpenInterval {
  /** Начало, включительно. */
  start: number;
  /** Конец, исключительно. */
  end: number;
}

/**
 * Переводит YearMonth в число месяцев от условного нуля.
 *
 * @param ym - месяц в формате YYYY-MM
 * @returns число месяцев (year * 12 + month - 1)
 */
export function toMonths(ym: YearMonth): number {
  return ym.year * 12 + (ym.month - 1);
}

/**
 * Обратный перевод числа месяцев в YearMonth.
 *
 * @param months - число месяцев от условного нуля
 * @returns месяц в формате YYYY-MM
 */
export function fromMonths(months: number): YearMonth {
  return {
    year: Math.floor(months / 12),
    month: (months % 12) + 1,
  };
}

/**
 * Парсит строку "YYYY-MM" в YearMonth.
 *
 * @param value - строка в формате YYYY-MM
 * @returns YearMonth
 * @throws Error, если формат неверный
 */
export function parseYearMonth(value: string): YearMonth {
  const match = /^(\d{4})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error(`Invalid YearMonth: "${value}". Expected YYYY-MM.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month in "${value}": ${month}.`);
  }

  return { year, month };
}

/**
 * Форматирует YearMonth в строку "YYYY-MM".
 *
 * @param ym - месяц в формате YYYY-MM
 * @returns строка "YYYY-MM"
 */
export function formatYearMonth(ym: YearMonth): string {
  const month = ym.month.toString().padStart(2, "0");
  return `${ym.year}-${month}`;
}

/**
 * Включительный подсчёт месяцев между start и end.
 *
 * Воспроизводит конвенцию hh.ru: 2003-10 -> 2005-07 = 22 месяца.
 *
 * @param start - начало интервала, включительно
 * @param end - конец интервала, включительно
 * @returns число месяцев или 0, если start > end
 */
export function monthsInclusive(start: YearMonth, end: YearMonth): number {
  const diff = toMonths(end) - toMonths(start) + 1;
  return diff > 0 ? diff : 0;
}

/**
 * Переводит включительный интервал `[s, e]` в полуоткрытый `[s, e+1)`.
 *
 * @param interval - включительный интервал
 * @returns полуоткрытый интервал в месяцах
 */
export function toHalfOpen(interval: InclusiveInterval): HalfOpenInterval {
  return {
    start: toMonths(interval.start),
    end: toMonths(interval.end) + 1,
  };
}

/**
 * Наивная сумма длительностей — воспроизводит конвенцию hh.ru.
 *
 * Не объединяет интервалы: два места работы со стыком в одном месяце
 * дадут на один месяц больше истины.
 *
 * @param intervals - список включительных интервалов
 * @returns сумма месяцев
 */
export function naiveSum(intervals: InclusiveInterval[]): number {
  return intervals.reduce((sum, interval) => sum + monthsInclusive(interval.start, interval.end), 0);
}

/**
 * Объединение полуоткрытых интервалов — истина без двойного счёта.
 *
 * Стандартное слияние: если next.start <= current.end, расширяем current.end.
 *
 * @param intervals - список полуоткрытых интервалов
 * @returns суммарная длина после объединения
 */
export function unionLength(intervals: HalfOpenInterval[]): number {
  if (intervals.length === 0) {
    return 0;
  }

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const first = sorted[0];

  if (!first) {
    return 0;
  }

  let total = 0;
  let currentStart = first.start;
  let currentEnd = first.end;

  for (let i = 1; i < sorted.length; i += 1) {
    const interval = sorted[i];

    if (!interval) {
      continue;
    }

    if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end);
    } else {
      total += currentEnd - currentStart;
      currentStart = interval.start;
      currentEnd = interval.end;
    }
  }

  total += currentEnd - currentStart;
  return total;
}
