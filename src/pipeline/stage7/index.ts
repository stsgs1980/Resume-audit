import { dirname, join } from "node:path";
import type { Facts } from "../../schemas/facts";
import { factsSchema } from "../../schemas/facts";
import type { StageState } from "../../schemas/stage-state";
import { stageStateSchema } from "../../schemas/stage-state";
import { readJson, writeJsonAtomic } from "../../server/storage/files";
import { buildDefenseDocument, writeDefenseDocument } from "./build-defense";
import { ensureLocked } from "./check-lock";
import { generateForRole } from "./generate-one";
import { validateFactIds, validateHedge } from "./postprocess";
import type { GeneratedResume, GenerationRoleId, Stage7Params, Stage7Result } from "./types";

/** Роли по умолчанию: все три. */
const ALL_ROLES: GenerationRoleId[] = ["sales", "salesops", "aipo"];

/**
 * Обновляет stage-state.json записями документов.
 *
 * @param resumesDir - директория версий (stage-state рядом, на уровень выше)
 * @param generated - сгенерированные версии
 */
async function updateStageState(resumesDir: string, generated: GeneratedResume[]): Promise<void> {
  const stageStatePath = join(dirname(resumesDir), "stage-state.json");
  let state: StageState;

  try {
    state = await readJson(stageStatePath, stageStateSchema);
  } catch {
    state = { run_id: "", stages: {}, documents: {} };
  }

  for (const resume of generated) {
    state.documents[resume.versionId] = {
      facts_hash: resume.factsHash,
      prompt_version: resume.promptVersion,
      model_id: resume.modelId,
      generated_at: resume.generatedAt,
      stale: false,
    };
  }

  await writeJsonAtomic(stageStatePath, state);
}

/**
 * Запускает этап 7: генерация версий, defense-документ, stage-state.
 * Ошибки по ролям фиксируются, этап не бросает исключений.
 *
 * @param params - пути, клиент, промты и модель
 * @returns итог этапа
 */
export async function runStage7(params: Stage7Params): Promise<Stage7Result> {
  const result: Stage7Result = {
    generated: [],
    skipped: [],
    errors: [],
    defensePath: null,
    warnings: [],
  };

  const locked = await ensureLocked(params.lockPath);

  if (!locked.ok) {
    result.errors.push({ roleId: "", reason: locked.reason ?? "facts.json не locked" });

    return result;
  }

  let facts: Facts;

  try {
    facts = await readJson(params.factsPath, factsSchema);
  } catch (error) {
    result.errors.push({ roleId: "", reason: (error as Error).message });

    return result;
  }

  const roles = params.targetRoleIds ?? ALL_ROLES;

  for (const roleId of roles) {
    try {
      const { resume, error } = await generateForRole(facts, roleId, params);

      if (resume === null) {
        result.errors.push({ roleId, reason: error ?? "unknown error" });

        continue;
      }

      for (const factId of validateFactIds(resume.document, facts)) {
        result.warnings.push({ code: "fact_id_unknown", message: `${roleId}: ${factId}` });
      }

      for (const factId of validateHedge(resume.document, facts)) {
        result.warnings.push({ code: "hedge_missing", message: `${roleId}: ${factId}` });
      }

      await writeJsonAtomic(join(params.resumesDir, `${resume.versionId}.json`), resume);
      result.generated.push(resume);
    } catch (error) {
      result.errors.push({ roleId, reason: (error as Error).message });
    }
  }

  try {
    const content = await buildDefenseDocument(facts, join(dirname(params.factsPath), "evidence"));

    await writeDefenseDocument(content, params.defensePath);
    result.defensePath = params.defensePath;
  } catch (error) {
    result.warnings.push({ code: "defense_failed", message: (error as Error).message });
  }

  try {
    await updateStageState(params.resumesDir, result.generated);
  } catch (error) {
    result.warnings.push({ code: "stage_state_failed", message: (error as Error).message });
  }

  return result;
}
