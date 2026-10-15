/** Вид исходного файла. */
export type FileKind =
  "hh_export" | "resume_draft" | "vacancy" | "flagged_synthetic" | "ai_inflated" | "technical_audit" | "unknown";

/** Статус чтения файла. */
export type FileStatus = "ok" | "unreadable" | "unsupported";

/** Запись инвентаря об одном файле. */
export interface FileEntry {
  /** Относительный путь в исходной директории. */
  path: string;
  /** Имя файла. */
  name: string;
  /** Классификация. */
  kind: FileKind;
  /** Статус чтения. */
  status: FileStatus;
  /** Кодировка текста или null для бинарных. */
  encoding: string | null;
  /** Предупреждения по файлу. */
  warnings: string[];
  /** Размер в байтах. */
  size: number;
}

/** Итог этапа 1. */
export interface Stage1Result {
  /** Сканированная директория. */
  rootDir: string;
  /** Время сканирования в ISO 8601. */
  scannedAt: string;
  /** Число записей в files. */
  totalFiles: number;
  /** Записи файлов. */
  files: FileEntry[];
  /** Ошибки этапа. */
  errors: Array<{ path: string; reason: string }>;
  /** Предупреждения этапа (например, отброшенные лимитом). */
  warnings: string[];
}

/** Параметры запуска этапа 1. */
export interface Stage1Params {
  /** Директория с исходными файлами. */
  rootDir: string;
  /** Путь к files.json. */
  outputPath: string;
  /** Максимальный размер файла, по умолчанию 20 МБ. */
  maxFileSizeBytes?: number;
  /** Максимальное число файлов, по умолчанию 100. */
  maxFiles?: number;
}
