import { dirname, join } from "node:path";
import type { StageState } from "../../schemas/stage-state";
import { stageStateSchema } from "../../schemas/stage-state";
import { readJson, writeJsonAtomic } from "../../server/storage/files";
import type { ValidationResult } from "./types";

/**
 * Обновляет stage-state.json итогами проверки.
 * При ошибках помечает ожидаемые, но не проверенные версии stale.
 *
 * @param validationDir - директория validation (stage-state рядом, на уровень выше)
 * @param validated - проверенные версии
 * @param errors - ошибки проверки
 * @param expectedVersionIds - ожидаемые версии текущего прогона
 * @returns void
 */
export async function updateStageState(
  validationDir: string,
  validated: ValidationResult[],
  errors: Array<{ versionId: string; reason: string }>,
  expectedVersionIds?: string[],
): Promise<void> {
  const stageStatePath = join(dirname(validationDir), "stage-state.json");
  let state: StageState;

  try {
    state = await readJson(stageStatePath, stageStateSchema);
  } catch {
    state = { run_id: "", stages: {}, documents: {} };
  }

  const blocked = validated.some((entry) => entry.blocked);
  const status = errors.length > 0 ? "failed" : blocked ? "blocked" : "completed";

  state.stages["verification"] = { status, updated_at: new Date().toISOString() };

  for (const entry of validated) {
    state.documents[entry.versionId] = {
      facts_hash: entry.factsHash,
      ...(entry.promptVersion === null ? {} : { prompt_version: entry.promptVersion }),
      ...(entry.modelId === null ? {} : { model_id: entry.modelId }),
      generated_at: entry.validatedAt,
      stale: entry.blocked,
    };
  }

  const validatedIds = new Set(validated.map((entry) => entry.versionId));
  const failedIds = new Set([
    ...(expectedVersionIds ?? []),
    ...errors.map((entry) => entry.versionId).filter((versionId) => versionId !== ""),
  ]);

  for (const versionId of failedIds) {
    const document = state.documents[versionId];

    if (!validatedIds.has(versionId) && document !== undefined) {
      state.documents[versionId] = { ...document, stale: true };
    }
  }

  await writeJsonAtomic(stageStatePath, state);
}
