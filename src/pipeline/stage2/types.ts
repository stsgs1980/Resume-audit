import type { LlmClient } from "../../llm/client";
import type { ExtractionResponse } from "../../llm/schemas";

/** Сырое утверждение из ответа LLM (без id). */
export type RawClaim = ExtractionResponse["claims"][number];

/** Категория утверждения. */
export type ClaimCategory = "employment" | "result" | "skill" | "tool" | "education" | "language" | "project" | "link";

/** Статус утверждения. */
export type ClaimStatus = "confirmed" | "needs_evidence" | "remove";

/** Утверждение с присвоенным id. */
export interface Claim {
  /** Id вида "claim1". */
  id: string;
  /** Формулировка утверждения. */
  statement: string;
  /** Дословная цитата. */
  quote: string;
  /** Файл-источник. */
  source_file: string;
  /** Категория. */
  category: ClaimCategory;
  /** Тип метрики. */
  metric_type: string;
  /** Число или null. */
  number: number | null;
  /** Валюта или null. */
  currency: "RUB" | "USD" | "EUR" | null;
  /** Статус. */
  status: ClaimStatus;
  /** Пояснение. */
  reason: string;
  /** Роли, явно упомянутые в контексте (если есть). */
  detected_roles?: string[];
  /** Косвенная метрика: требуется оговорка. */
  requires_hedge?: boolean;
}

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
