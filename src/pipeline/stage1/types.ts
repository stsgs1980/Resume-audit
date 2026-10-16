import type { FileEntry } from "../../schemas/files";

export type { FileEntry, FileKind, FileStatus } from "../../schemas/files";

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
