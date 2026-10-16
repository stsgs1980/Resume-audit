import { z } from "zod";
import { readJson } from "../../server/storage/files";

/** Схема чтения lock-файла: новый объект или legacy-строка. */
const lockReadSchema = z.union([z.string(), z.record(z.string(), z.unknown())]);

/**
 * Проверяет блокировку facts.json.
 *
 * @param lockPath - путь к facts.lock
 * @returns итог проверки
 */
export async function ensureLocked(lockPath: string): Promise<{ ok: boolean; reason: string | null }> {
  let parsed: string | Record<string, unknown>;

  try {
    parsed = await readJson(lockPath, lockReadSchema);
  } catch {
    return { ok: false, reason: "facts.json не в состоянии locked" };
  }

  const state = typeof parsed === "string" ? parsed : parsed["state"];

  if (state === "locked") {
    return { ok: true, reason: null };
  }

  return { ok: false, reason: "facts.json не в состоянии locked" };
}
