/**
 * Форматирование стажа: "N лет M месяцев" с русскими склонениями.
 */

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
