/** Достоверность извлечённых дат. */
export type DateConfidence = "high" | "medium" | "low" | null;

/** Диапазон дат из цитаты. */
export interface DateRange {
  /** Начало YYYY-MM или null. */
  start: string | null;
  /** Конец YYYY-MM или null. */
  end: string | null;
  /** Голый год без месяца, сохранённый как есть, или null. */
  year: string | null;
  /** Достоверность: high — дата месяца, medium — смешанная точность, low — только год, null — дат нет. */
  confidence: DateConfidence;
  /** Признак текущей работы. */
  isCurrent: boolean;
}

/** Найденная дата с точностью. */
interface FoundDate {
  /** YYYY-MM при точности month или YYYY при точности year. */
  value: string;
  /** Позиция начала совпадения. */
  index: number;
  /** Точность: месяц или только год. */
  precision: "month" | "year";
}

/** ISO-дата YYYY-MM. */
const ISO_PATTERN = /\b((?:19|20)\d{2})-(0[1-9]|1[0-2])\b/;

/** Русский формат MM.YYYY. */
const RU_PATTERN = /\b(0[1-9]|1[0-2])\.((?:19|20)\d{2})\b/;

/** Маркеры текущей работы. */
const CURRENT_MARKERS = ["по настоящее время", "по н.в.", "сейчас"];

/** Названия месяцев в именительном и родительном падежах. */
const MONTHS: Record<string, string> = {
  январь: "01",
  января: "01",
  февраль: "02",
  февраля: "02",
  март: "03",
  марта: "03",
  апрель: "04",
  апреля: "04",
  май: "05",
  мая: "05",
  июнь: "06",
  июня: "06",
  июль: "07",
  июля: "07",
  август: "08",
  августа: "08",
  сентябрь: "09",
  сентября: "09",
  октябрь: "10",
  октября: "10",
  ноябрь: "11",
  ноября: "11",
  декабрь: "12",
  декабря: "12",
};

const MONTH_NAME_PATTERN =
  /(январь|января|февраль|февраля|март|марта|апрель|апреля|май|мая|июнь|июня|июль|июля|август|августа|сентябрь|сентября|октябрь|октября|ноябрь|ноября|декабрь|декабря)\s+((?:19|20)\d{2})/i;

/** Голый год. */
const YEAR_PATTERN = /\b((?:19|20)\d{2})\b/;

/**
 * Находит даты в тексте с точностью до месяца или года.
 * Голые годы, входящие в найденные месяцы (2003 внутри 2003-10), не дублируются.
 *
 * @param text - цитата утверждения
 * @returns даты по порядку упоминания
 */
function findDates(text: string): FoundDate[] {
  const found: FoundDate[] = [];
  const monthSpans: Array<[number, number]> = [];

  const pushMonthMatches = (pattern: RegExp, build: (match: RegExpMatchArray) => string | null): void => {
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) {
        continue;
      }

      const value = build(match);

      if (value === null) {
        continue;
      }

      found.push({ value, index: match.index, precision: "month" });
      monthSpans.push([match.index, match.index + match[0].length]);
    }
  };

  pushMonthMatches(new RegExp(ISO_PATTERN.source, "g"), (match) =>
    match[1] !== undefined && match[2] !== undefined ? `${match[1]}-${match[2]}` : null,
  );
  pushMonthMatches(new RegExp(RU_PATTERN.source, "g"), (match) =>
    match[2] !== undefined && match[1] !== undefined ? `${match[2]}-${match[1]}` : null,
  );
  pushMonthMatches(new RegExp(MONTH_NAME_PATTERN.source, "gi"), (match) =>
    match[2] !== undefined ? `${match[2]}-${MONTHS[(match[1] ?? "").toLowerCase()] ?? "01"}` : null,
  );

  for (const match of text.matchAll(new RegExp(YEAR_PATTERN.source, "g"))) {
    if (match.index === undefined) {
      continue;
    }

    const span: [number, number] = [match.index, match.index + match[0].length];
    const insideMonth = monthSpans.some(([start, end]) => span[0] < end && start < span[1]);

    if (!insideMonth) {
      found.push({ value: match[1] ?? "", index: match.index, precision: "year" });
    }
  }

  return found.sort((left, right) => left.index - right.index);
}

/**
 * Извлекает диапазон дат из цитаты. Голый год не превращается в месяц 01:
 * при нехватке данных он возвращается в поле year с confidence low.
 *
 * @param quote - цитата утверждения
 * @returns начало, конец, год, достоверность и признак текущей работы
 */
export function extractDateRange(quote: string): DateRange {
  const empty: DateRange = { start: null, end: null, year: null, confidence: null, isCurrent: false };

  if (quote.trim().length === 0) {
    return empty;
  }

  const lower = quote.toLowerCase();
  const isCurrent = CURRENT_MARKERS.some((marker) => lower.includes(marker));
  const found = findDates(quote);
  const months = found.filter((date) => date.precision === "month");
  const years = found.filter((date) => date.precision === "year");

  if (found.length === 0) {
    return { ...empty, isCurrent };
  }

  const confidence: DateConfidence = months.length === 0 ? "low" : years.length === 0 ? "high" : "medium";
  const start = months[0]?.value ?? null;
  const lastMonth = months[months.length - 1]?.value ?? null;
  let end: string | null = null;

  if (!isCurrent && start !== null) {
    if (months.length >= 2) {
      end = lastMonth;
    } else if (years.length === 0) {
      end = start;
    }
  }

  return { start, end, year: years[0]?.value ?? null, confidence, isCurrent };
}
