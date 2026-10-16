import type { LlmClient } from "../../llm/client";
import type { ResumeResponse } from "../../llm/schemas";

/** Id целевой роли генерации. */
export type GenerationRoleId = "sales" | "salesops" | "aipo";

/** Сгенерированная версия резюме с провенансом. */
export interface GeneratedResume {
  /** Id версии вида "hh_v1_sales". */
  versionId: string;
  /** Целевая роль. */
  roleId: GenerationRoleId;
  /** Время генерации в ISO 8601. */
  generatedAt: string;
  /** Хеш фактов на момент генерации. */
  factsHash: string;
  /** Версия промта вида "generation.sales.v1". */
  promptVersion: string;
  /** Id модели. */
  modelId: string;
  /** Документ резюме. */
  document: ResumeResponse;
}

/** Итог этапа 7. */
export interface Stage7Result {
  /** Сгенерированные версии. */
  generated: GeneratedResume[];
  /** Пропущенные роли с причинами. */
  skipped: Array<{ roleId: string; reason: string }>;
  /** Ошибки по ролям. */
  errors: Array<{ roleId: string; reason: string }>;
  /** Путь к interview-defense.md или null. */
  defensePath: string | null;
  /** Предупреждения (предвестники верификации). */
  warnings: Array<{ code: string; message: string }>;
}

/** Параметры запуска этапа 7. */
export interface Stage7Params {
  /** Путь к facts.json. */
  factsPath: string;
  /** Путь к facts.lock. */
  lockPath: string;
  /** Директория конфигов ролей. */
  rolesConfigDir: string;
  /** Директория версий резюме. */
  resumesDir: string;
  /** Путь к interview-defense.md. */
  defensePath: string;
  /** LLM-клиент. */
  llmClient: LlmClient;
  /** Конфиг загрузчика промтов. */
  promptConfig: { promptsDir: string };
  /** Id модели. */
  modelId: string;
  /** Роли для генерации, по умолчанию все три. */
  targetRoleIds?: GenerationRoleId[];
}
