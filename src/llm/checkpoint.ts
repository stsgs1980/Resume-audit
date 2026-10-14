import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Checkpoint, CheckpointStatus } from "./types";

const CHECKPOINT_STATUSES: CheckpointStatus[] = ["running", "completed", "failed", "incomplete"];

/**
 * Мини-версия атомарной записи (долг: вынести writeJsonAtomic в общий модуль).
 *
 * @param filePath - целевой путь
 * @param data - сериализуемые данные
 */
async function writeJsonAtomicLocal(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp.${process.pid}.${randomBytes(6).toString("hex")}`;

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  try {
    await rename(tmpPath, filePath);
  } catch (error) {
    await unlink(tmpPath).catch(() => undefined);
    throw error;
  }
}

/**
 * Проверяет, допустим ли статус чекпоинта.
 *
 * @param status - кандидат в статус
 * @returns true для running/completed/failed/incomplete
 */
function isCheckpointStatus(status: unknown): status is CheckpointStatus {
  return typeof status === "string" && (CHECKPOINT_STATUSES as string[]).includes(status);
}

/**
 * Читает чекпоинт этапа. Файла нет — null.
 *
 * @param stageStatePath - путь к stage-state.json
 * @param stageId - id этапа
 * @returns чекпоинт или null
 */
export async function readCheckpoint(stageStatePath: string, stageId: string): Promise<Checkpoint | null> {
  let text: string;

  try {
    text = await readFile(stageStatePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }

  const parsed = JSON.parse(text) as Record<string, unknown>;
  const stages =
    typeof parsed["stages"] === "object" && parsed["stages"] !== null
      ? (parsed["stages"] as Record<string, unknown>)
      : {};
  const entry = stages[stageId];

  if (typeof entry !== "object" || entry === null) {
    return null;
  }

  const record = entry as Record<string, unknown>;

  if (!isCheckpointStatus(record["status"])) {
    return null;
  }

  return {
    stageId,
    status: record["status"],
    updatedAt: typeof record["updated_at"] === "string" ? record["updated_at"] : "",
  };
}

/**
 * Пишет чекпоинт этапа атомарно (остальное содержимое сохраняет).
 *
 * @param stageStatePath - путь к stage-state.json
 * @param checkpoint - чекпоинт
 */
export async function writeCheckpoint(stageStatePath: string, checkpoint: Checkpoint): Promise<void> {
  let parsed: Record<string, unknown> = { run_id: "", stages: {}, documents: {} };

  try {
    parsed = JSON.parse(await readFile(stageStatePath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const stages =
    typeof parsed["stages"] === "object" && parsed["stages"] !== null
      ? { ...(parsed["stages"] as Record<string, unknown>) }
      : {};

  stages[checkpoint.stageId] = { status: checkpoint.status, updated_at: checkpoint.updatedAt };

  await writeJsonAtomicLocal(stageStatePath, { ...parsed, stages });
}

/**
 * Сохраняет частичный ответ этапа.
 *
 * @param dir - директория частичных ответов
 * @param stageId - id этапа
 * @param response - частичный ответ
 * @returns путь к файлу
 */
export async function savePartialResponse(dir: string, stageId: string, response: unknown): Promise<string> {
  await mkdir(dir, { recursive: true });

  const filePath = join(dir, `${stageId}-${Date.now()}.json`);

  await writeFile(filePath, `${JSON.stringify(response, null, 2)}\n`, "utf8");

  return filePath;
}
