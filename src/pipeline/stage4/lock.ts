import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Evidence } from "../../schemas/evidence";
import { evidenceSchema } from "../../schemas/evidence";
import type { Facts } from "../../schemas/facts";
import { writeJsonAtomic } from "../../server/storage/files";
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
      const parsed = JSON.parse(await readFile(join(evidenceDir, name), "utf8")) as unknown;
      const validated = evidenceSchema.safeParse(parsed);

      if (validated.success) {
        cards.push(validated.data);
      }
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
    facts = JSON.parse(await readFile(factsPath, "utf8")) as Facts;
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

  await writeJsonAtomic(lockPath, { state: "locked", lockedAt: new Date().toISOString() });

  return { locked: true, reasons: [] };
}
