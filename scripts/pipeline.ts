import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { createLlmClient } from "../src/llm/client";
import { DEFAULT_GENERATE_TIMEOUT_MS } from "../src/llm/types";
import { runPipeline } from "../src/pipeline/run";
import type { StorageConfig } from "../src/server/storage/paths";
import { createStorageConfig, isValidSlug } from "../src/server/storage/paths";
import { printArtifacts, printFooter, printHeader, printStages } from "./pipeline-output.ts";

/** Модель по умолчанию. */
const DEFAULT_MODEL = "opencode/space-bunny-free";

/** URL локального opencode server по умолчанию. */
const DEFAULT_SERVER_URL = "http://127.0.0.1:49374";

/** Разобранные аргументы CLI. */
interface CliOptions {
  /** Slug workspace или undefined. */
  workspace: string | undefined;
  /** Путь к входным файлам или undefined. */
  input: string | undefined;
  /** Пропустить LLM-этапы. */
  skipLlm: boolean;
  /** Дата аудита YYYY-MM-DD. */
  auditDate: string;
  /** Id модели. */
  model: string;
}

/**
 * Возвращает сегодняшнюю дату в формате YYYY-MM-DD.
 *
 * @returns дата
 */
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Проверяет дату в формате YYYY-MM-DD.
 *
 * @param value - строка даты
 * @returns true, если дата существует
 */
function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Читает значение аргумента.
 *
 * @param argv - аргументы процесса
 * @param index - индекс значения
 * @param flag - имя флага
 * @returns значение
 */
function readValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];

  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Не задано значение для ${flag}`);
  }

  return value;
}

/**
 * Разбирает аргументы командной строки.
 *
 * @param argv - аргументы процесса
 * @returns параметры CLI
 */
function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    workspace: undefined,
    input: undefined,
    skipLlm: false,
    auditDate: today(),
    model: DEFAULT_MODEL,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--skip-llm":
        options.skipLlm = true;
        break;
      case "--workspace":
        options.workspace = readValue(argv, index + 1, arg);
        index += 1;
        break;
      case "--input":
        options.input = readValue(argv, index + 1, arg);
        index += 1;
        break;
      case "--audit-date": {
        const value = readValue(argv, index + 1, arg);

        if (!isValidDate(value)) {
          throw new Error(`Неверная дата аудита: ${value} (ожидается YYYY-MM-DD)`);
        }

        options.auditDate = value;
        index += 1;
        break;
      }
      case "--model":
        options.model = readValue(argv, index + 1, arg);
        index += 1;
        break;
      default:
        throw new Error(`Неизвестный аргумент: ${arg}`);
    }
  }

  return options;
}

/**
 * Определяет workspace по slug или берёт первый из data/workspaces/.
 *
 * @param storage - конфиг хранилища
 * @param slug - slug workspace или undefined
 * @returns путь и slug workspace
 */
async function resolveWorkspace(
  storage: StorageConfig,
  slug: string | undefined,
): Promise<{ dir: string; slug: string }> {
  const workspacesDir = join(storage.rootDir, "workspaces");

  if (slug !== undefined) {
    if (!isValidSlug(slug)) {
      throw new Error(`Неверный slug workspace: ${slug}`);
    }

    const candidate = join(workspacesDir, slug);

    try {
      const info = await stat(candidate);

      if (!info.isDirectory()) {
        throw new Error("not a directory");
      }

      return { dir: candidate, slug };
    } catch {
      throw new Error(`Workspace не найден: ${candidate}`);
    }
  }

  const entries = await readdir(workspacesDir, { withFileTypes: true }).catch(() => null);

  if (entries === null) {
    throw new Error("Нет workspace в data/workspaces/");
  }

  const first = entries
    .filter((entry) => entry.isDirectory() && isValidSlug(entry.name))
    .map((entry) => entry.name)
    .sort()[0];

  if (first === undefined) {
    throw new Error(`Нет workspace в ${workspacesDir}`);
  }

  return { dir: join(workspacesDir, first), slug: first };
}

/**
 * Создаёт LLM-клиент для CLI.
 *
 * @param modelId - id модели
 * @returns клиент
 */
function createClient(modelId: string): ReturnType<typeof createLlmClient> {
  const configured = process.env["OPENCODE_SERVER_URL"]?.trim();
  const serverUrl = configured === undefined || configured === "" ? DEFAULT_SERVER_URL : configured;
  const normalized = serverUrl.replace(/\/+$/, "");
  const baseUrl = normalized.endsWith("/api") ? normalized : `${normalized}/api`;

  return createLlmClient({
    baseUrl,
    model: modelId,
    retryCount: 2,
    timeoutMs: DEFAULT_GENERATE_TIMEOUT_MS,
  });
}

/**
 * Точка входа CLI.
 *
 * @returns void
 */
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const storageConfig = createStorageConfig();
  const workspace = await resolveWorkspace(storageConfig, options.workspace);
  const inputDir = options.input ?? join(workspace.dir, "input");
  const llmClient = options.skipLlm ? null : createClient(options.model);

  printHeader(workspace.dir, inputDir, options.auditDate);

  const result = await runPipeline({
    workspaceDir: workspace.dir,
    inputDir,
    llmClient,
    promptConfig: { promptsDir: "config/prompts" },
    rolesConfigPath: "config/roles/sales.json",
    modelId: options.model,
    auditDate: options.auditDate,
    skipLlmStages: options.skipLlm,
    storageConfig,
    slug: workspace.slug,
    onProgress: (stage, message) => {
      if (process.stdout.isTTY) {
        console.log(`[${stage}/8] ${message}`);
      }
    },
  });

  printStages(result.stages);
  printArtifacts(workspace.dir, result.artifacts);
  printFooter(result);

  if (result.overallStatus === "failed" || result.stages.some((stage) => stage.status === "failed")) {
    process.exitCode = 1;
  }
}

await main().catch((error: unknown) => {
  console.log(`[FAIL] ${(error as Error).message}`);
  process.exitCode = 1;
});
