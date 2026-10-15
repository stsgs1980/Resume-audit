import { readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { writeJsonAtomic } from "../../server/storage/files";
import { classifyFile } from "./classify";
import { readAnyFile } from "./read-file";
import type { FileEntry, Stage1Params, Stage1Result } from "./types";

/** Лимит размера файла по умолчанию: 20 МБ. */
const DEFAULT_MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Лимит числа файлов по умолчанию. */
const DEFAULT_MAX_FILES = 100;

/** Пропускаемые директории и префиксы. */
const IGNORED = new Set(["node_modules", ".git", "dist", "build"]);

/** Поддерживаемые расширения. */
const SUPPORTED = new Set([".md", ".txt", ".html", ".htm", ".docx", ".pdf"]);

/**
 * Рекурсивно собирает относительные пути файлов, пропуская служебное.
 *
 * @param rootDir - корень сканирования
 * @returns отсортированный список относительных путей
 */
async function listFilesRecursive(rootDir: string): Promise<string[]> {
  const found: string[] = [];
  const queue: string[] = [""];

  while (queue.length > 0) {
    const current = queue.pop() as string;
    const absolute = join(rootDir, current);
    const entries = await readdir(absolute, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".") || IGNORED.has(entry.name)) {
        continue;
      }

      const relativePath = join(current, entry.name);

      if (entry.isDirectory()) {
        queue.push(relativePath);
      } else if (entry.isFile()) {
        found.push(relativePath);
      }
    }
  }

  return found.sort();
}

/**
 * Обрабатывает один файл: размер, расширение, чтение, классификация.
 *
 * @param rootDir - корень сканирования
 * @param relativePath - относительный путь файла
 * @param maxFileSizeBytes - лимит размера
 * @returns запись инвентаря
 */
async function processFile(rootDir: string, relativePath: string, maxFileSizeBytes: number): Promise<FileEntry> {
  const absolute = join(rootDir, relativePath);
  const name = basename(relativePath);
  const info = await stat(absolute);
  const base: Omit<FileEntry, "kind" | "status" | "encoding" | "warnings"> = {
    path: relativePath,
    name,
    size: info.size,
  };

  if (info.size > maxFileSizeBytes) {
    return { ...base, kind: "unknown", status: "unsupported", encoding: null, warnings: ["Превышен лимит размера"] };
  }

  if (!SUPPORTED.has(extname(name).toLowerCase())) {
    return {
      ...base,
      kind: "unknown",
      status: "unsupported",
      encoding: null,
      warnings: ["Неподдерживаемое расширение"],
    };
  }

  try {
    const { text, encoding } = await readAnyFile(absolute);

    return { ...base, kind: classifyFile(text, name), status: "ok", encoding, warnings: [] };
  } catch (error) {
    return {
      ...base,
      kind: "unknown",
      status: "unreadable",
      encoding: null,
      warnings: [(error as Error).message],
    };
  }
}

/**
 * Запускает этап 1: инвентаризация, чтение, классификация, files.json.
 * Исключения наружу не бросает: всё фиксируется в errors[].
 *
 * @param params - rootDir, outputPath и лимиты
 * @returns итог этапа
 */
export async function runStage1(params: Stage1Params): Promise<Stage1Result> {
  const maxFileSizeBytes = params.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
  const maxFiles = params.maxFiles ?? DEFAULT_MAX_FILES;
  const result: Stage1Result = {
    rootDir: params.rootDir,
    scannedAt: new Date().toISOString(),
    totalFiles: 0,
    files: [],
    errors: [],
    warnings: [],
  };

  let discovered: string[];

  try {
    discovered = await listFilesRecursive(params.rootDir);
  } catch (error) {
    result.errors.push({ path: params.rootDir, reason: (error as Error).message });

    return result;
  }

  const scanned = discovered.slice(0, maxFiles);

  for (const skipped of discovered.slice(maxFiles)) {
    result.warnings.push(`Отброшен лимитом maxFiles: ${skipped}`);
  }

  for (const relativePath of scanned) {
    try {
      result.files.push(await processFile(params.rootDir, relativePath, maxFileSizeBytes));
    } catch (error) {
      result.errors.push({ path: relativePath, reason: (error as Error).message });
    }
  }

  result.totalFiles = result.files.length;

  try {
    await writeJsonAtomic(params.outputPath, result);
  } catch (error) {
    result.errors.push({ path: params.outputPath, reason: (error as Error).message });
  }

  return result;
}
