import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ZodType } from "zod";
import { FileNotFoundError, InvalidJsonError, SchemaValidationError } from "./errors";

/**
 * Проверяет, является ли код ошибки признаком занятого файла на Windows.
 *
 * @param error - пойманная ошибка
 * @returns true для EEXIST/EPERM
 */
function isWindowsBusyFile(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;

  return code === "EEXIST" || code === "EPERM";
}

/**
 * Атомарно записывает JSON: tmp-файл + rename.
 *
 * @param filePath - целевой путь
 * @param data - сериализуемые данные
 * @returns void
 */
export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp.${process.pid}.${randomBytes(6).toString("hex")}`;

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  try {
    await rename(tmpPath, filePath);
  } catch (error) {
    if (!isWindowsBusyFile(error)) {
      await unlink(tmpPath).catch(() => undefined);
      throw error;
    }

    try {
      await unlink(filePath);
      await rename(tmpPath, filePath);
    } catch (retryError) {
      await unlink(tmpPath).catch(() => undefined);
      throw retryError;
    }
  }
}

/**
 * Читает JSON и валидирует по Zod-схеме.
 *
 * @param filePath - путь к файлу
 * @param schema - Zod-схема ожидаемых данных
 * @returns распарсенные и провалидированные данные
 * @throws FileNotFoundError если файла нет
 * @throws InvalidJsonError если JSON битый
 * @throws SchemaValidationError если данные не по схеме
 */
export async function readJson<T>(filePath: string, schema: ZodType<T>): Promise<T> {
  let text: string;

  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new FileNotFoundError(filePath);
    }

    throw error;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    throw new InvalidJsonError(filePath, (error as Error).message);
  }

  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new SchemaValidationError(filePath, result.error.issues);
  }

  return result.data;
}

/**
 * Проверяет существование файла.
 *
 * @param filePath - путь к файлу
 * @returns true, если файл читается
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);

    return true;
  } catch {
    return false;
  }
}
