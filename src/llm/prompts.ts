import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** Конфиг загрузчика промтов. */
export interface PromptConfig {
  /** Директория файлов config/prompts/<id>.v<version>.md. */
  promptsDir: string;
}

/** Запись реестра файлов промтов. */
export interface PromptFile {
  /** Id промта. */
  id: string;
  /** Версия промта. */
  version: number;
  /** Полный путь к файлу. */
  path: string;
}

/**
 * Промт не найден.
 */
export class PromptNotFoundError extends Error {
  /**
   * @param id - id промта
   * @param version - версия промта
   */
  constructor(id: string, version: number) {
    super(`Prompt not found: ${id}.v${version}`);
    this.name = "PromptNotFoundError";
  }
}

const cache = new Map<string, string>();
const FILE_PATTERN = /^([a-z_]+)\.v(\d+)\.md$/;

/**
 * Конфиг по умолчанию: config/prompts.
 *
 * @returns конфиг загрузчика
 */
export function defaultPromptConfig(): PromptConfig {
  return { promptsDir: "config/prompts" };
}

/**
 * Читает текст промта с кэшем в памяти.
 *
 * @param id - id промта
 * @param version - версия промта
 * @param config - конфиг загрузчика
 * @returns содержимое файла
 */
export async function loadPrompt(
  id: string,
  version: number,
  config: PromptConfig = defaultPromptConfig(),
): Promise<string> {
  const key = `${id}.v${version}`;
  const cached = cache.get(key);

  if (cached !== undefined) {
    return cached;
  }

  let text: string;

  try {
    text = await readFile(join(config.promptsDir, `${key}.md`), "utf8");
  } catch {
    throw new PromptNotFoundError(id, version);
  }

  cache.set(key, text);

  return text;
}

/**
 * Сбрасывает кэш промтов (для тестов).
 */
export function resetPromptCache(): void {
  cache.clear();
}

/**
 * Список файлов промтов: только имена вида <id>.v<version>.md.
 *
 * @param config - конфиг загрузчика
 * @returns отсортированный список (сначала id, затем версия)
 */
export async function listPrompts(config: PromptConfig = defaultPromptConfig()): Promise<PromptFile[]> {
  let names: string[];

  try {
    names = await readdir(config.promptsDir);
  } catch {
    return [];
  }

  const files: PromptFile[] = [];

  for (const name of names) {
    const match = FILE_PATTERN.exec(name);

    if (match?.[1] !== undefined && match[2] !== undefined) {
      files.push({ id: match[1], version: Number(match[2]), path: join(config.promptsDir, name) });
    }
  }

  return files.sort((left, right) => {
    if (left.id !== right.id) {
      return left.id < right.id ? -1 : 1;
    }

    return left.version - right.version;
  });
}
