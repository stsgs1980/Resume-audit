import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { ResumeResponse } from "../../llm/schemas";
import type { Facts } from "../../schemas/facts";
import { writeJsonAtomic } from "../../server/storage/files";
import { hashFacts } from "../../server/storage/hash";
import { computeBlockReason, isBlocked } from "./block";
import { verifyLayer1 } from "./layer1";
import { verifyLayer2 } from "./layer2";
import type { Stage8Params, Stage8Result, ValidationResult } from "./types";

/**
 * Проверяет блокировку facts.json.
 *
 * @param lockPath - путь к facts.lock
 * @returns true, если state locked
 */
async function isLocked(lockPath: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(await readFile(lockPath, "utf8")) as unknown;
    const state = typeof parsed === "string" ? parsed : (parsed as Record<string, unknown>)["state"];

    return state === "locked";
  } catch {
    return false;
  }
}

/**
 * Извлекает roleId из версии: поле roleId, затем суффикс hh_v1_*.
 *
 * @param parsed - распарсенная версия резюме
 * @param versionId - id версии
 * @returns роль или null
 */
function extractRoleId(parsed: Record<string, unknown>, versionId: string): string | null {
  if (typeof parsed["roleId"] === "string") {
    return parsed["roleId"] as string;
  }

  const match = /^hh_v1_(.+)$/.exec(versionId);

  return match?.[1] !== undefined && match[1].length > 0 ? (match[1] as string) : null;
}

/**
 * Извлекает документ резюме: поле document или сам файл.
 *
 * @param parsed - распарсенная версия резюме
 * @returns документ резюме или null
 */
function extractDocument(parsed: Record<string, unknown>): ResumeResponse | null {
  const candidate = (parsed["document"] ?? parsed) as Record<string, unknown>;

  return Array.isArray(candidate["jobs"]) ? (candidate as unknown as ResumeResponse) : null;
}

/**
 * Обновляет stage-state.json итогами проверки версий.
 *
 * @param validationDir - директория validation (stage-state рядом, на уровень выше)
 * @param validated - проверенные версии
 */
async function updateStageState(validationDir: string, validated: ValidationResult[]): Promise<void> {
  const stageStatePath = join(dirname(validationDir), "stage-state.json");
  let state: { run_id: string; stages: Record<string, unknown>; documents: Record<string, unknown> };

  try {
    state = JSON.parse(await readFile(stageStatePath, "utf8")) as typeof state;
  } catch {
    state = { run_id: "", stages: {}, documents: {} };
  }

  const failed = validated.some((entry) => entry.blocked);

  state.stages["verification"] = { status: failed ? "blocked" : "completed", updated_at: new Date().toISOString() };

  for (const entry of validated) {
    state.documents[entry.versionId] = {
      facts_hash: entry.factsHash,
      ...(entry.promptVersion === null ? {} : { prompt_version: entry.promptVersion }),
      ...(entry.modelId === null ? {} : { model_id: entry.modelId }),
      generated_at: entry.validatedAt,
      stale: entry.blocked,
    };
  }

  await writeJsonAtomic(stageStatePath, state);
}

/**
 * Запускает этап 8: слой 1 + слой 2 по каждой версии, validation/*.json.
 * Исключений не бросает: всё фиксируется в errors/warnings.
 *
 * @param params - пути, клиент, промты и модель
 * @returns итог этапа
 */
export async function runStage8(params: Stage8Params): Promise<Stage8Result> {
  const result: Stage8Result = { validated: [], skipped: [], errors: [], warnings: [], exportBlocked: false };

  if (!(await isLocked(params.lockPath))) {
    result.errors.push({ versionId: "", reason: "facts.json не в состоянии locked" });

    return result;
  }

  let facts: Facts;

  try {
    facts = JSON.parse(await readFile(params.factsPath, "utf8")) as Facts;
  } catch (error) {
    result.errors.push({ versionId: "", reason: (error as Error).message });

    return result;
  }

  let files: string[];

  try {
    files = (await readdir(params.resumesDir)).filter((name) => /^hh_v1_.+\.json$/.test(name));
  } catch (error) {
    result.errors.push({ versionId: "", reason: (error as Error).message });

    return result;
  }

  const useLayer2 = params.enableLayer2 ?? true;
  const factsHash = hashFacts(facts);

  for (const name of files) {
    const versionId = basename(name, ".json");

    try {
      const parsed = JSON.parse(await readFile(join(params.resumesDir, name), "utf8")) as Record<string, unknown>;
      const document = extractDocument(parsed);
      const roleId = extractRoleId(parsed, versionId);

      if (document === null || roleId === null) {
        result.errors.push({ versionId, reason: "файл версии не содержит резюме" });

        continue;
      }

      const layer1 = verifyLayer1(document, facts, roleId, params.rolesConfigPath);
      let layer2: ValidationResult["layer2"] = null;
      let promptVersion: string | null = null;
      let modelId: string | null = null;

      if (useLayer2) {
        const layer2Result = await verifyLayer2(document, facts, roleId, params.llmClient, params.promptConfig);

        if (layer2Result.layer2 === null) {
          result.warnings.push({ code: "layer2_failed", message: `${versionId}: ${layer2Result.error}` });
        } else {
          layer2 = layer2Result.layer2;
          promptVersion = "verification.v1";
          modelId = params.modelId;
        }
      }

      const blockReasons = computeBlockReason(layer1, layer2);
      const entry: ValidationResult = {
        versionId,
        roleId,
        validatedAt: new Date().toISOString(),
        factsHash,
        promptVersion,
        modelId,
        layer1,
        layer2,
        blocked: isBlocked(blockReasons),
        blockReasons,
      };

      await writeJsonAtomic(join(params.validationDir, `${versionId}.json`), entry);
      result.validated.push(entry);
    } catch (error) {
      result.errors.push({ versionId, reason: (error as Error).message });
    }
  }

  result.exportBlocked = result.validated.some((entry) => entry.blocked);

  try {
    await updateStageState(params.validationDir, result.validated);
  } catch (error) {
    result.warnings.push({ code: "stage_state_failed", message: (error as Error).message });
  }

  return result;
}
