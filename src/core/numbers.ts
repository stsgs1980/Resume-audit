/**
 * Нормализация чисел: извлечение значения, валюты, кросс-проверка.
 *
 * См. docs/superpowers/specs/SPEC-pipeline.md раздел 3.2.
 */

/** Валюта из контекста строки. Отсутствие валюты — null, без дефолта. */
export type Currency = "RUB" | "USD" | "EUR";

/** Уточнение числа: точное, приблизительное, процент. */
export type NumberQualifier = "exact" | "approx" | "percent" | "approx-percent";

/** Нормализованное число. */
export interface ParsedNumber {
  value: number;
  currency: Currency | null;
  qualifier: NumberQualifier;
}

/** Серьёзность расхождения двух чисел одной метрики. */
export type CheckSeverity = "ok" | "warning" | "hard";

/** Итог кросс-проверки двух чисел. */
export interface CrossCheckResult {
  severity: CheckSeverity;
  reason: string;
}

const MILLION = 1_000_000;
const THOUSAND = 1_000;
const BILLION = 1_000_000_000;
const DIVERGENCE_THRESHOLD = 0.02;

/**
 * Определяет валюту по контексту строки.
 *
 * RUB: знак рубля, "руб", "RUB". USD: "$", "USD", "доллар".
 * EUR: знак евро, "EUR", "евро". Маркер ищется earliest-match:
 * побеждает самое раннее вхождение. Ничего не найдено — null.
 * Валюта по умолчанию никогда не подставляется.
 *
 * @param context - строка с числом и возможным указанием валюты
 * @returns валюта или null, если валюта не указана
 */
export function detectCurrency(context: string): Currency | null {
  const candidates: Array<{ index: number; currency: Currency }> = [];
  const rubIndex = context.search(/₽|\brub\b|(?<![а-яёa-z])руб/iu);
  const usdIndex = context.search(/\$|\busd\b|(?<![а-яёa-z])долл/iu);
  const eurIndex = context.search(/€|\beur\b|(?<![а-яёa-z])евро/iu);

  if (rubIndex >= 0) {
    candidates.push({ index: rubIndex, currency: "RUB" });
  }

  if (usdIndex >= 0) {
    candidates.push({ index: usdIndex, currency: "USD" });
  }

  if (eurIndex >= 0) {
    candidates.push({ index: eurIndex, currency: "EUR" });
  }

  candidates.sort((a, b) => a.index - b.index);
  const first = candidates[0];

  return first ? first.currency : null;
}

/**
 * Возвращает множитель для текстовой единицы после числа.
 *
 * @param unitText - единица в нижнем регистре ("" если нет)
 * @returns множитель: миллиард, миллион, тысяча или 1
 */
function multiplierForUnit(unitText: string): number {
  if (/миллиард|млрд|billion/.test(unitText)) {
    return BILLION;
  }

  if (/миллион|млн|million|mln/.test(unitText)) {
    return MILLION;
  }

  if (/тысяч|тысяча|тыс|thousand|\bk\b/.test(unitText)) {
    return THOUSAND;
  }

  return 1;
}

/**
 * Парсит числовую подстроку в базовое значение.
 *
 * Убирает пробельные разделители тысяч. Одиночная запятая при множителе —
 * десятичная. Без множителя вид "1,000" читается как тысяча.
 *
 * @param raw - числовая подстрока из исходного текста
 * @param multiplier - множитель единицы (нужен для трактовки запятой)
 * @returns базовое число или null, если не парсится
 */
function parseBaseValue(raw: string, multiplier: number): number | null {
  const cleaned = raw.replace(/[\s\u00A0\u202F]/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let base: number;

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");

    if (lastComma > lastDot) {
      base = Number(cleaned.replace(/\./g, "").replace(",", "."));
    } else {
      base = Number(cleaned.replace(/,/g, ""));
    }
  } else if (hasComma) {
    if (multiplier > 1) {
      base = Number(cleaned.replace(",", "."));
    } else if (/^-?\d{1,3}(,\d{3})+$/.test(cleaned)) {
      base = Number(cleaned.replace(/,/g, ""));
    } else {
      base = Number(cleaned.replace(",", "."));
    }
  } else {
    base = Number(cleaned);
  }

  return Number.isFinite(base) ? base : null;
}

/**
 * Извлекает первое число из строки: значение, валюту, уточнение.
 *
 * Поддерживает "4,2 млн", "4.2 млн", "4 200 000", "120 тыс.",
 * "$1,02 млн", "45%", "~4 млн". Пробелы-разделители включают обычные
 * и неразрывные. Приблизительность: "~", "≈", "около", "примерно".
 * Без числа возвращает null. Валюта — через detectCurrency.
 *
 * @param text - исходная строка с числом
 * @returns нормализованное число или null, если числа нет
 */
export function parseNumber(text: string): ParsedNumber | null {
  const numberMatch = /-?\d(?:[\d\s\u00A0\u202F]*\d)?(?:[.,]\d+)?/.exec(text);

  if (!numberMatch) {
    return null;
  }

  const raw = numberMatch[0];
  const after = text.slice(numberMatch.index + raw.length);
  const unitMatch =
    /^\s*(миллиард\w*|млрд\.?|billion\w*|миллион\w*|млн\.?|million\w*|mln\.?|тысяч\w*|тысяча|тыс\.?|thousand\w*|k\b|%)/i.exec(
      after,
    );
  const unitText = unitMatch?.[1] ? unitMatch[1].toLowerCase() : "";
  const isPercent = unitText === "%";
  const multiplier = isPercent ? 1 : multiplierForUnit(unitText);
  const base = parseBaseValue(raw, multiplier);

  if (base === null) {
    return null;
  }

  const value = multiplier > 1 ? Math.round(base * multiplier) : base;
  const isApprox = /[~≈∼]/.test(text) || /\b(около|примерно)\b/i.test(text);
  const qualifier: NumberQualifier = isPercent
    ? isApprox
      ? "approx-percent"
      : "percent"
    : isApprox
      ? "approx"
      : "exact";

  return { value, currency: detectCurrency(text), qualifier };
}

/**
 * Сравнивает два числа одной метрики.
 *
 * Совпадение — ok. Расхождение меньше 2% — warning. Расхождение 2%
 * и больше — hard (жёсткое расхождение). Если хотя бы одно число
 * приблизительное ("~", "около"), расхождение трактуется как warning
 * "возможно округление" вместо hard.
 *
 * @param a - первое нормализованное число
 * @param b - второе нормализованное число
 * @returns серьёзность и причину на русском языке
 */
export function crossCheckNumbers(a: ParsedNumber, b: ParsedNumber): CrossCheckResult {
  const magnitude = Math.max(Math.abs(a.value), Math.abs(b.value));

  if (magnitude === 0 || a.value === b.value) {
    return { severity: "ok", reason: "числа совпадают" };
  }

  const diff = Math.abs(a.value - b.value) / magnitude;
  const percent = (diff * 100).toFixed(1);
  const isApprox =
    a.qualifier === "approx" ||
    a.qualifier === "approx-percent" ||
    b.qualifier === "approx" ||
    b.qualifier === "approx-percent";

  if (isApprox) {
    return { severity: "warning", reason: `возможно округление: расхождение ${percent}%` };
  }

  if (diff < DIVERGENCE_THRESHOLD) {
    return { severity: "warning", reason: `расхождение ${percent}% меньше 2%: предупреждение` };
  }

  return { severity: "hard", reason: `расхождение ${percent}% 2% и больше: жёсткое расхождение` };
}
