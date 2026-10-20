import { dirname, join } from "node:path";
import { auditSchema } from "../../schemas/audit";
import type { Facts } from "../../schemas/facts";
import { factsSchema } from "../../schemas/facts";
import { readJson, writeJsonAtomic } from "../../server/storage/files";
import { hashFacts, hashMeta } from "../../server/storage/hash";
import { invalidateAllDocuments } from "../../server/storage/stage-state";
import { readFactsHash, resetLockIfFactsChanged } from "./facts-lock";
import type { Stage4aParams, Stage4aResult, Stage4Warning } from "./types";

/**
 * Обновляет audit.json хешами записанных фактов.
 * audit.json отсутствует — тихо пропускается.
 *
 * @param auditPath - путь к audit.json
 * @param facts - записанные факты
 * @returns void
 */
async function updateAuditHashes(auditPath: string, facts: Facts): Promise<void> {
  try {
    const audit = await readJson(auditPath, auditSchema);

    await writeJsonAtomic(auditPath, { ...audit, facts_hash: hashFacts(facts), meta_hash: hashMeta(facts) });
  } catch (error) {
    if ((error as Error).name !== "FileNotFoundError") {
      throw error;
    }
  }
}

/**
 * Записывает факты и обновляет производные состояния.
 *
 * @param params - параметры этапа
 * @param facts - валидированные факты
 * @param warnings - накопитель предупреждений
 * @returns true, если facts.json записан
 */
async function writeFactsArtifacts(params: Stage4aParams, facts: Facts, warnings: Stage4Warning[]): Promise<boolean> {
  const previousHash = await readFactsHash(params.factsPath);
  const lockPath = params.lockPath ?? join(dirname(params.factsPath), "facts.lock");

  try {
    await resetLockIfFactsChanged(lockPath, previousHash, hashFacts(facts));
  } catch (error) {
    warnings.push({ code: "lock_reset_failed", message: (error as Error).message });

    return false;
  }

  try {
    await writeJsonAtomic(params.factsPath, facts);
  } catch (error) {
    warnings.push({ code: "write_failed", message: (error as Error).message });

    return false;
  }

  try {
    await updateAuditHashes(params.auditPath, facts);
  } catch (error) {
    warnings.push({ code: "audit_update_failed", message: (error as Error).message });
  }

  if (params.storageConfig !== undefined && params.slug !== undefined) {
    try {
      await invalidateAllDocuments(params.storageConfig, params.slug, hashFacts(facts));
    } catch (error) {
      warnings.push({ code: "invalidate_failed", message: (error as Error).message });
    }
  }

  return true;
}

/**
 * Валидирует и записывает факты, обновляет производные и lock.
 *
 * @param params - параметры этапа
 * @param facts - собранные факты
 * @param warnings - накопитель предупреждений
 * @returns итог этапа
 */
export async function persistFacts(
  params: Stage4aParams,
  facts: Facts,
  warnings: Stage4Warning[],
): Promise<Stage4aResult> {
  const generatedAt = new Date().toISOString();
  const validated = factsSchema.safeParse(facts);

  if (!validated.success) {
    warnings.push({
      code: "schema_mismatch",
      message: `facts.json не прошёл схему: ${JSON.stringify(validated.error.issues)}`,
    });

    return { generatedAt, facts, written: false, warnings };
  }

  const written = await writeFactsArtifacts(params, validated.data, warnings);

  return { generatedAt, facts: validated.data, written, warnings };
}
