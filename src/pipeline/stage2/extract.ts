import { z } from "zod";
import type { LlmClient } from "../../llm/client";
import { getPromptSpec } from "../../llm/prompt-registry";
import { loadPrompt } from "../../llm/prompts";
import type { ExtractionResponse } from "../../llm/schemas";
import { extractionResponseSchema } from "../../llm/schemas";
import type { FileEntry } from "../stage1/types";
import type { RawClaim } from "./types";

/** Допустимые категории claim. */
const CATEGORIES = new Set(["employment", "result", "skill", "tool", "education", "language", "project", "link"]);

/** Допустимые статусы claim. */
const STATUSES = new Set(["confirmed", "needs_evidence", "remove"]);

/** Допустимые типы метрик. */
const METRIC_TYPES = new Set([
  "выручка",
  "конверсия",
  "текучесть",
  "объём продаж",
  "товарооборот",
  "команда",
  "затраты",
  "производительность",
  "срок",
  "иное",
]);

/** Допустимые валюты. */
const CURRENCIES = new Set(["RUB", "USD", "EUR"]);

/**
 * Проверяет, что значение является объектом.
 *
 * @param value - проверяемое значение
 * @returns true для обычного объекта
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Форматирует ошибки Zod в компактную строку.
 *
 * @param error - ошибка схемы
 * @returns список полей и сообщений
 */
function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");
}

/**
 * Мягко исправляет одно утверждение под extractionResponseSchema.
 *
 * @param raw - сырое утверждение
 * @param index - индекс утверждения
 * @param warnings - накопитель предупреждений
 * @returns исправленное утверждение
 */
function softenClaim(raw: unknown, index: number, warnings: string[]): unknown {
  if (!isRecord(raw)) {
    return raw;
  }

  const claim = { ...raw };
  const path = `claim[${index}]`;
  const category = claim["category"];

  if (typeof category !== "string" || !CATEGORIES.has(category)) {
    warnings.push(`${path}.category: ${String(category)} -> "result"`);
    claim["category"] = "result";
  }

  const status = claim["status"];

  if (typeof status !== "string" || !STATUSES.has(status)) {
    warnings.push(`${path}.status: ${String(status)} -> "needs_evidence"`);
    claim["status"] = "needs_evidence";
  }

  const metricType = claim["metric_type"];

  if (typeof metricType !== "string" || !METRIC_TYPES.has(metricType)) {
    warnings.push(`${path}.metric_type: ${String(metricType)} -> "иное"`);
    claim["metric_type"] = "иное";
  }

  const number = claim["number"];

  if (number !== null && (typeof number !== "number" || !Number.isFinite(number))) {
    warnings.push(`${path}.number: ${String(number)} -> null`);
    claim["number"] = null;
  }

  const currency = claim["currency"];

  if (currency !== null && (typeof currency !== "string" || !CURRENCIES.has(currency))) {
    warnings.push(`${path}.currency: ${String(currency)} -> null`);
    claim["currency"] = null;
  }

  return claim;
}

/**
 * Проверяет ответ extraction и мягко исправляет известные отклонения.
 *
 * @param raw - распарсенный JSON ответа
 * @param schema - схема extractionResponseSchema
 * @returns валидные данные или null и предупреждения
 */
export function softenExtractionResponse(
  raw: unknown,
  schema: z.ZodType<ExtractionResponse>,
): { data: ExtractionResponse | null; warnings: string[] } {
  const direct = schema.safeParse(raw);

  if (direct.success) {
    return { data: direct.data, warnings: [] };
  }

  const warnings: string[] = [];

  if (!isRecord(raw) || !Array.isArray(raw["claims"])) {
    warnings.push(`schema mismatch: ${formatIssues(direct.error)}`);

    return { data: null, warnings };
  }

  const claims = raw["claims"].map((claim, index) => softenClaim(claim, index, warnings));
  const parsed = schema.safeParse({ ...raw, claims });

  if (!parsed.success) {
    warnings.push(`schema mismatch: ${formatIssues(parsed.error)}`);

    return { data: null, warnings };
  }

  if (warnings.length > 0) {
    warnings.push(`softened_fields: ${warnings.length}`);
  }

  return { data: parsed.data, warnings };
}

/**
 * Извлекает утверждения из одного текста через промт extraction.
 * Про чанкинг ничего не знает: один вызов — один текст.
 *
 * @param _file - запись файла из files.json (контекст вызывающей стороны)
 * @param text - очищенный текст файла
 * @param llmClient - LLM-клиент
 * @param promptConfig - конфиг загрузчика промтов
 * @param promptConfig.promptsDir - директория файлов промтов
 * @returns сырые утверждения, ошибка и предупреждения
 */
export async function extractClaimsFromFile(
  _file: FileEntry,
  text: string,
  llmClient: LlmClient,
  promptConfig: { promptsDir: string },
): Promise<{ claims: RawClaim[]; error: string | null; warnings: string[] }> {
  const promptText = await loadPrompt("extraction", 1, promptConfig);
  const spec = getPromptSpec<ExtractionResponse>("extraction");
  const result = await llmClient.call<unknown>({
    system: spec.system,
    user: `${promptText}\n\n---\n\n${text}`,
    schema: z.unknown(),
    stage: "extraction",
  });

  if (!result.ok) {
    return { claims: [], error: result.error.message, warnings: [] };
  }

  const softened = softenExtractionResponse(result.data, extractionResponseSchema);

  if (softened.data === null) {
    return {
      claims: [],
      error: softened.warnings.join("; "),
      warnings: softened.warnings,
    };
  }

  return { claims: softened.data.claims, error: null, warnings: softened.warnings };
}
