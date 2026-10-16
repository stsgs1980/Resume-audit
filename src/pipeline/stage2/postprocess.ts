import type { Claim, RawClaim } from "./types";

/** Допустимые статусы утверждений. */
const CLAIM_STATUSES = new Set(["confirmed", "needs_evidence", "remove"]);

/**
 * Нормализует цитату для сравнения дубликатов.
 *
 * @param quote - исходная цитата
 * @returns trim + lowercase
 */
function normalizeQuote(quote: string): string {
  return quote.trim().toLowerCase();
}

/**
 * Чистит сырые утверждения: отсев без quote/statement/status, id и source_file.
 *
 * @param rawClaims - сырые утверждения из ответа LLM
 * @param sourceFile - файл-источник
 * @param startId - начальный номер id
 * @returns чистые утверждения
 */
export function validateAndCleanClaims(rawClaims: RawClaim[], sourceFile: string, startId: number): Claim[] {
  const cleaned: Claim[] = [];
  let index = 0;

  for (const raw of rawClaims) {
    if (raw.quote.trim().length === 0) {
      continue;
    }

    if (raw.statement.trim().length === 0) {
      continue;
    }

    if (!CLAIM_STATUSES.has(raw.status)) {
      continue;
    }

    cleaned.push({
      id: `claim${startId + index}`,
      statement: raw.statement,
      quote: raw.quote,
      source_file: sourceFile,
      category: raw.category,
      metric_type: raw.metric_type,
      number: raw.number,
      currency: raw.currency,
      status: raw.status,
      reason: raw.reason,
      detected_roles: raw.detected_roles,
      requires_hedge: raw.requires_hedge,
    });
    index += 1;
  }

  return cleaned;
}

/**
 * Склеивает дубликаты по нормализованной цитате. Id пересобираются.
 *
 * @param allClaims - утверждения из всех файлов и чанков
 * @returns уникальные утверждения
 */
export function mergeClaimsByQuote(allClaims: Claim[]): Claim[] {
  const seen = new Map<string, Claim>();

  for (const claim of allClaims) {
    const key = normalizeQuote(claim.quote);

    if (!seen.has(key)) {
      seen.set(key, claim);
    }
  }

  return [...seen.values()].map((claim, index) => ({ ...claim, id: `claim${index + 1}` }));
}
