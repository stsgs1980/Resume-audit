/** Организационно-правовые формы: сами по себе компанией не являются. */
const LEGAL_FORMS = new Set(["ООО", "АО", "ЗАО", "ПАО", "ИП"]);

/** Предлоги и союзы: название компании на них не заканчивается. */
const PREPOSITIONS = new Set([
  "и",
  "в",
  "во",
  "на",
  "с",
  "со",
  "по",
  "для",
  "от",
  "до",
  "за",
  "под",
  "при",
  "о",
  "об",
  "из",
  "у",
  "к",
  "ко",
  "но",
  "или",
  "либо",
  "а",
]);

/** Контекст перед названием: «в», «в компании», «работал в», «в должности». */
const COMPANY_CONTEXT = /(?:^|\s)в\s+(?:компании\s+|должности\s+)?/giu;

/** Максимум слов в названии. */
const MAX_NAME_WORDS = 3;

/** Минимум значащих символов в названии. */
const MIN_NAME_SYMBOLS = 2;

/**
 * Очищает слово от кавычек по краям.
 *
 * @param token - слово из цитаты
 * @returns слово без кавычек
 */
function stripQuotes(token: string): string {
  return token.replace(/^["'«»„“”]+|["'«»„“”]+$/gu, "");
}

/**
 * Разбирает название компании из текста после контекстного слова.
 * Захватывает 1-3 слова с заглавной, пропускает формы «ООО»/«ИП»,
 * останавливается на предлоге, союзе или слове без заглавной.
 *
 * @param rest - текст после контекста
 * @returns название компании или null
 */
function parseCompanyName(rest: string): string | null {
  const segment = rest.split(/[.,;:!?()[\]{}]/u)[0] ?? "";
  const words: string[] = [];

  for (const raw of segment.split(/\s+/u)) {
    const token = stripQuotes(raw);

    if (token === "" || LEGAL_FORMS.has(token.toUpperCase())) {
      continue;
    }

    if (!/^[А-ЯЁA-Z]/u.test(token) || PREPOSITIONS.has(token.toLowerCase())) {
      break;
    }

    words.push(token);

    if (words.length === MAX_NAME_WORDS) {
      break;
    }
  }

  const name = words.join(" ");
  const significant = name.replace(/[^\p{L}\p{N}]/gu, "");

  return significant.length >= MIN_NAME_SYMBOLS ? name : null;
}

/**
 * Извлекает название компании из текста. Компания не угадывается:
 * нет уверенного совпадения — null.
 *
 * @param text - формулировка или цитата
 * @returns название компании или null
 */
export function extractCompany(text: string): string | null {
  for (const match of text.matchAll(new RegExp(COMPANY_CONTEXT.source, "giu"))) {
    if (match.index === undefined) {
      continue;
    }

    const name = parseCompanyName(text.slice(match.index + match[0].length));

    if (name !== null) {
      return name;
    }
  }

  return null;
}

/**
 * Определяет компанию утверждения: формулировка, затем цитата.
 *
 * @param claim - утверждение с полями statement и quote
 * @param claim.statement
 * @param claim.quote
 * @returns название компании или null
 */
export function detectClaimCompany(claim: { statement: string; quote: string }): string | null {
  return extractCompany(claim.statement) ?? extractCompany(claim.quote);
}
