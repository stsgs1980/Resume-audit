import type { LlmClient } from "../llm/client";
import type { StorageConfig } from "../server/storage/paths";

/** Id этапа конвейера. */
export type StageId = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";

/** Статус этапа. */
export type StageStatus = "completed" | "skipped" | "failed";

/** Параметры запуска конвейера. */
export interface PipelineParams {
  /** Директория workspace: data/workspaces/<slug>. */
  workspaceDir: string;
  /** Директория с исходными файлами. */
  inputDir: string;
  /** LLM-клиент или null (тогда LLM-этапы пропускаются). */
  llmClient: LlmClient | null;
  /** Конфиг загрузчика промтов. */
  promptConfig: { promptsDir: string };
  /** Путь к конфигу ролей: config/roles/sales.json. */
  rolesConfigPath: string;
  /** Id модели вида provider/model. */
  modelId: string;
  /** Дата аудита YYYY-MM-DD. */
  auditDate: string;
  /** Принудительно пропустить этапы 2, 5, 7, 8. */
  skipLlmStages?: boolean;
  /** Требовать facts.lock перед этапом 7, по умолчанию true. */
  requireLockForStage7?: boolean;
  /** Конфиг хранилища для инвалидации производных документов. */
  storageConfig?: StorageConfig;
  /** Slug workspace для инвалидации производных документов. */
  slug?: string;
  /** Колбэк прогресса: id этапа и сообщение. */
  onProgress?: (stage: string, message: string) => void;
}

/** Итог одного этапа. */
export interface PipelineStageResult {
  /** Id этапа "1"..."8". */
  id: StageId;
  /** Название этапа. */
  name: string;
  /** Статус. */
  status: StageStatus;
  /** Длительность в миллисекундах. */
  durationMs: number;
  /** Краткая сводка результата. */
  summary: string;
  /** Текст ошибки для failed. */
  error?: string;
  /** Предупреждения этапа. */
  warnings: string[];
}

/** Артефакты прогона (пути внутри workspace). */
export interface PipelineArtifacts {
  /** Путь к files.json или null. */
  filesJson: string | null;
  /** Путь к claims.json или null. */
  claimsJson: string | null;
  /** Путь к audit.json или null. */
  auditJson: string | null;
  /** Путь к facts.json или null. */
  factsJson: string | null;
  /** Путь к interview-defense.md или null. */
  defenseMd: string | null;
  /** Пути к сгенерированным резюме. */
  resumes: string[];
  /** Пути к результатам верификации. */
  validation: string[];
}

/** Итог прогона конвейера. */
export interface PipelineResult {
  /** Время начала в ISO 8601. */
  startedAt: string;
  /** Время завершения в ISO 8601. */
  finishedAt: string;
  /** Итоги этапов по порядку. */
  stages: PipelineStageResult[];
  /** Пути артефактов. */
  artifacts: PipelineArtifacts;
  /** Итоговый статус. */
  overallStatus: "success" | "partial" | "failed";
}

/** Пути артефактов workspace. */
export interface WorkspacePaths {
  /** files.json. */
  files: string;
  /** claims.json. */
  claims: string;
  /** audit.json. */
  audit: string;
  /** facts.json. */
  facts: string;
  /** facts.lock. */
  lock: string;
  /** Директория резюме. */
  resumesDir: string;
  /** Директория validation. */
  validationDir: string;
  /** interview-defense.md. */
  defense: string;
}
