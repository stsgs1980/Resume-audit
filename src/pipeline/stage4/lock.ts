import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Evidence } from "../../schemas/evidence";
import { evidenceSchema } from "../../schemas/evidence";
import type { Facts } from "../../schemas/facts";
import { factsSchema } from "../../schemas/facts";
import { readJson, writeJsonAtomic } from "../../server/storage/files";
import type { LockState } from "../../server/storage/lock";
import { canLock } from "../../server/storage/lock";

/**
 * Читает все валидные карточки evidence из директории.
 *
 * @param evidenceDir - директория карточек
 * @returns карточки
 */
async function readEvidenceCards(evidenceDir: string): Promise<Evidence[]> {
  let names: string[];

  try {
    names = await readdir(evidenceDir);
  } catch {
    return [];
  }

  const cards: Evidence[] = [];

  for (const name of names) {
    if (!name.endsWith(".json")) {
      continue;
    }

    try {
      cards.push(await readJson(join(evidenceDir, name), evidenceSchema));
    } catch {
      // Битые карточки пропускаются.
    }
  }

  return cards;
}

/**
 * Пытается перевести факты в locked через canLock.
 *
 * @param factsPath - путь к facts.json
 * @param lockPath - путь к lock-файлу
 * @param evidenceDir - директория карточек
 * @param answersPath - директория ответов (доступность проверяется)
 * @returns итог с причинами
 */
export async function tryLock(
  factsPath: string,
  lockPath: string,
  evidenceDir: string,
  answersPath: string,
): Promise<{ locked: boolean; reasons: string[] }> {
  const reasons: string[] = [];

  try {
    await readdir(answersPath);
  } catch {
    reasons.push("answers unreadable");
  }

  let facts: Facts;

  try {
    facts = await readJson(factsPath, factsSchema);
  } catch (error) {
    return { locked: false, reasons: [...reasons, `facts unreadable: ${(error as Error).message}`] };
  }

  const checked = canLock(facts, await readEvidenceCards(evidenceDir));

  if (!checked.ok) {
    return { locked: false, reasons: [...reasons, ...checked.reasons] };
  }

  if (reasons.length > 0) {
    return { locked: false, reasons };
  }

  const locked: LockState = { state: "locked", lockedAt: new Date().toISOString() };

  await writeJsonAtomic(lockPath, locked);

  return { locked: true, reasons: [] };
}
