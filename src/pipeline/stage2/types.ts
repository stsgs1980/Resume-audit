import type { LlmClient } from "../../llm/client";
import type { ExtractionResponse } from "../../llm/schemas";
import type { Claim } from "../../schemas/claims";

export type { Claim };

/** Сырое утверждение из ответа LLM (без id). */
export type RawClaim = ExtractionResponse["claims"][number];

/** Категория утверждения. */
export type ClaimCategory = Claim["category"];

/** Статус утверждения. */
export type ClaimStatus = Claim["status"];

/** Итог этапа 2. */
export interface ClaimsResult {
  /** Время генерации в ISO 8601. */
  generatedAt: string;
  /** Число утверждений. */
  totalClaims: number;
  /** Утверждения. */
  claims: Claim[];
  /** Число claims по каждому файлу. */
  byFile: Record<string, number>;
  /** Пропущенные файлы с причинами. */
  skipped: Array<{ file: string; reason: string }>;
  /** Ошибки обработки. */
  errors: Array<{ file: string; reason: string }>;
  /** Предупреждения этапа. */
  warnings: string[];
}

/** Параметры запуска этапа 2. */
export interface Stage2Params {
  /** Путь к files.json. */
  filesPath: string;
  /** Путь к claims.json. */
  claimsPath: string;
  /** LLM-клиент. */
  llmClient: LlmClient;
  /** Конфиг загрузчика промтов. */
  promptConfig: { promptsDir: string };
  /** Порог чанкинга в символах, по умолчанию 60 000. */
  chunkThreshold?: number;
  /** Лимит файлов (по умолчанию без лимита). */
  maxFilesToProcess?: number;
  /** Директория частичных ответов, по умолчанию data/partial. */
  partialDir?: string;
}
