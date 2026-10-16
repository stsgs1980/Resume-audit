/** Диапазон дат из цитаты. */
export interface DateRange {
  /** Начало YYYY-MM или null. */
  start: string | null;
  /** Конец YYYY-MM или null. */
  end: string | null;
  /** Признак текущей работы. */
  isCurrent: boolean;
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
 * Находит все даты YYYY-MM в тексте (ISO, MM.YYYY, месяц YYYY, год).
 *
 * @param text - цитата утверждения
 * @returns даты по порядку упоминания
 */
function findDates(text: string): string[] {
  const iso = [...text.matchAll(new RegExp(ISO_PATTERN.source, "g"))].map((match) => `${match[1]}-${match[2]}`);

  if (iso.length > 0) {
    return iso;
  }

  const ru = [...text.matchAll(new RegExp(RU_PATTERN.source, "g"))].map((match) => `${match[2]}-${match[1]}`);

  if (ru.length > 0) {
    return ru;
  }

  const named = [...text.matchAll(new RegExp(MONTH_NAME_PATTERN.source, "gi"))].map(
    (match) => `${match[2]}-${MONTHS[(match[1] ?? "").toLowerCase()] ?? "01"}`,
  );

  if (named.length > 0) {
    return named;
  }

  return [...text.matchAll(new RegExp(YEAR_PATTERN.source, "g"))].map((match) => `${match[1]}-01`);
}

/**
 * Извлекает диапазон дат из цитаты.
 *
 * @param quote - цитата утверждения
 * @returns начало, конец и признак текущей работы
 */
export function extractDateRange(quote: string): DateRange {
  const empty: DateRange = { start: null, end: null, isCurrent: false };

  if (quote.trim().length === 0) {
    return empty;
  }

  const lower = quote.toLowerCase();
  const isCurrent = CURRENT_MARKERS.some((marker) => lower.includes(marker));
  const dates = findDates(quote);

  if (dates.length === 0) {
    return { ...empty, isCurrent };
  }

  return {
    start: dates[0] ?? null,
    end: isCurrent ? null : (dates[dates.length - 1] ?? null),
    isCurrent,
  };
}
