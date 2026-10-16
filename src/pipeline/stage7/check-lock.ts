import { readFile } from "node:fs/promises";

/**
 * Проверяет блокировку facts.json.
 *
 * @param lockPath - путь к facts.lock
 * @returns итог проверки
 */
export async function ensureLocked(lockPath: string): Promise<{ ok: boolean; reason: string | null }> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(lockPath, "utf8")) as unknown;
  } catch {
    return { ok: false, reason: "facts.json не в состоянии locked" };
  }

  const state = typeof parsed === "string" ? parsed : (parsed as Record<string, unknown>)["state"];

  if (state === "locked") {
    return { ok: true, reason: null };
  }

  return { ok: false, reason: "facts.json не в состоянии locked" };
}
