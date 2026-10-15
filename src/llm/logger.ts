import { appendFile, mkdir, rename, stat, unlink } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

/** Одна запись журнала LLM: только метаданные, без содержимого. */
export interface LlmLogEntry {
  /** Время записи в ISO 8601. */
  timestamp: string;
  /** Этап конвейера. */
  stage: string;
  /** Id модели. */
  model: string;
  /** Длина system + user в символах. */
  promptLength: number;
  /** Длина ответа в символах. */
  responseLength: number;
  /** Время вызова в миллисекундах. */
  durationMs: number;
  /** Число попыток. */
  attempts: number;
  /** Успех вызова. */
  ok: boolean;
  /** Вид ошибки или null. */
  errorKind: string | null;
}

/** Конфиг журнала. */
export interface LogConfig {
  /** Директория журнала. */
  logDir: string;
  /** Максимальный размер файла в байтах. */
  maxFileSizeBytes: number;
  /** Сколько файлов хранить (base + .1 ...). */
  maxFiles: number;
}

/** Имя текущего файла журнала. */
const LOG_FILE_NAME = "model-responses.log";

/**
 * Конфиг журнала по умолчанию: data/logs, 5 МБ, 3 файла.
 *
 * @returns конфиг журнала
 */
export function defaultLogConfig(): LogConfig {
  return { logDir: "data/logs", maxFileSizeBytes: 5_000_000, maxFiles: 3 };
}

/**
 * Путь ротированного файла: model-responses.log -> model-responses.1.log.
 *
 * @param logPath - путь текущего файла
 * @param index - номер ротации (0 — текущий файл)
 * @returns путь ротированного файла
 */
function numberedPath(logPath: string, index: number): string {
  if (index === 0) {
    return logPath;
  }

  const extension = extname(logPath);

  return join(dirname(logPath), `${basename(logPath, extension)}.${index}${extension}`);
}

/**
 * Перемещение с fallback для Windows (unlink + rename при EEXIST/EPERM).
 *
 * @param from - исходный путь
 * @param to - целевой путь
 */
async function moveFile(from: string, to: string): Promise<void> {
  try {
    await rename(from, to);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== "EEXIST" && code !== "EPERM") {
      throw error;
    }

    await unlink(to);
    await rename(from, to);
  }
}

/**
 * Ротирует журнал при превышении размера. Файла нет — ничего не делает.
 *
 * @param logPath - путь текущего файла
 * @param maxFileSizeBytes - максимальный размер в байтах
 * @param maxFiles - сколько файлов хранить
 */
export async function rotateIfNeeded(logPath: string, maxFileSizeBytes: number, maxFiles: number): Promise<void> {
  let size: number;

  try {
    size = (await stat(logPath)).size;
  } catch {
    return;
  }

  if (size <= maxFileSizeBytes) {
    return;
  }

  await unlink(numberedPath(logPath, maxFiles - 1)).catch(() => undefined);

  for (let index = maxFiles - 1; index >= 1; index -= 1) {
    const from = numberedPath(logPath, index - 1);
    const to = numberedPath(logPath, index);

    try {
      await moveFile(from, to);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

/**
 * Добавляет запись в журнал (одна строка JSON + \n).
 *
 * @param entry - запись (только метаданные, без содержимого резюме)
 * @param config - конфиг журнала
 */
export async function writeLogEntry(entry: LlmLogEntry, config: LogConfig = defaultLogConfig()): Promise<void> {
  await mkdir(config.logDir, { recursive: true });

  const logPath = join(config.logDir, LOG_FILE_NAME);

  await rotateIfNeeded(logPath, config.maxFileSizeBytes, config.maxFiles);
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}
