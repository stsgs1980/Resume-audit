import type { Facts } from "../../schemas/facts";
import { factsSchema } from "../../schemas/facts";
import { readJson, writeJsonAtomic } from "../../server/storage/files";
import { hashFacts } from "../../server/storage/hash";
import { ensureLocked } from "../stage7/check-lock";

/**
 * Читает существующие факты.
 *
 * @param factsPath - путь к facts.json
 * @returns факты или null, если файла нет или он невалиден
 */
export async function readFacts(factsPath: string): Promise<Facts | null> {
  try {
    return await readJson(factsPath, factsSchema);
  } catch {
    return null;
  }
}

/**
 * Читает хеш существующих фактов.
 *
 * @param factsPath - путь к facts.json
 * @returns хеш или null, если файла нет или он невалиден
 */
export async function readFactsHash(factsPath: string): Promise<string | null> {
  const facts = await readFacts(factsPath);

  return facts === null ? null : hashFacts(facts);
}

/**
 * Сбрасывает locked в draft, если содержимое фактов изменилось.
 *
 * @param lockPath - путь к facts.lock или undefined
 * @param previousHash - хеш фактов до записи или null
 * @param nextHash - хеш записанных фактов
 * @returns void
 */
export async function resetLockIfFactsChanged(
  lockPath: string | undefined,
  previousHash: string | null,
  nextHash: string,
): Promise<void> {
  if (lockPath === undefined || previousHash === nextHash) {
    return;
  }

  if ((await ensureLocked(lockPath)).ok) {
    await writeJsonAtomic(lockPath, { state: "draft", lockedAt: null });
  }
}
