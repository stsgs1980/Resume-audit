import { createHash } from "node:crypto";
import type { Facts } from "../../schemas/facts";

/**
 * Приводит значение к канонической форме: ключи объектов отсортированы.
 *
 * @param value - произвольное JSON-значение
 * @returns значение с отсортированными ключами
 */
function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : canonicalValue(item)));
  }

  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(value).sort()) {
      const prop = (value as Record<string, unknown>)[key];

      if (prop !== undefined) {
        sorted[key] = canonicalValue(prop);
      }
    }

    return sorted;
  }

  return value ?? null;
}

/**
 * Сериализует значение в канонический JSON: порядок ключей не влияет.
 *
 * @param value - произвольное JSON-значение
 * @returns каноническая JSON-строка
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(canonicalValue(value)) ?? "null";
}

/**
 * Хеширует значение каноническим SHA-256 с префиксом.
 *
 * @param value - значение для хеширования
 * @returns хеш вида "sha256:..."
 */
function sha256prefixed(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalize(value), "utf8").digest("hex")}`;
}

/**
 * Считает facts_hash: только контент фактов, без meta.
 *
 * @param facts - факты из facts.json
 * @returns хеш вида "sha256:..."
 */
export function hashFacts(facts: Facts): string {
  return sha256prefixed({
    jobs: facts.jobs,
    education: facts.education,
    languages: facts.languages,
    confirmed_skills: facts.confirmed_skills,
    portfolio_projects: facts.portfolio_projects,
  });
}

/**
 * Считает meta_hash: только содержимое meta.
 *
 * @param facts - факты из facts.json
 * @returns хеш вида "sha256:..."
 */
export function hashMeta(facts: Facts): string {
  return sha256prefixed(facts.meta);
}
