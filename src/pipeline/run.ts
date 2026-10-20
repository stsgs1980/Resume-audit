import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileExists } from "../server/storage/files";
import type { RunContext } from "./run-context";
import { workspacePaths } from "./run-context";
import { recordEmbeddedStages, runAuditStage, runClaimsStage, runFactsStage, runFilesStage } from "./run-stages";
import { runGenerationStage, runVerificationStage } from "./run-stages-llm";
import type {
  PipelineArtifacts,
  PipelineParams,
  PipelineResult,
  PipelineStageResult,
  StageId,
  StageStatus,
  WorkspacePaths,
} from "./run-types";

export type {
  PipelineArtifacts,
  PipelineParams,
  PipelineResult,
  PipelineStageResult,
  StageId,
  StageStatus,
} from "./run-types";

/**
 * Перечисляет json-файлы директории.
 *
 * @param dir - директория
 * @returns отсортированные пути или пустой массив
 */
async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const names = await readdir(dir);

    return names
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => join(dir, name));
  } catch {
    return [];
  }
}

/**
 * Собирает пути артефактов прогона.
 *
 * @param paths - пути workspace
 * @returns артефакты
 */
async function collectArtifacts(paths: WorkspacePaths): Promise<PipelineArtifacts> {
  const [files, claims, audit, facts, defense, resumes, validation] = await Promise.all([
    fileExists(paths.files),
    fileExists(paths.claims),
    fileExists(paths.audit),
    fileExists(paths.facts),
    fileExists(paths.defense),
    listJsonFiles(paths.resumesDir),
    listJsonFiles(paths.validationDir),
  ]);

  return {
    filesJson: files ? paths.files : null,
    claimsJson: claims ? paths.claims : null,
    auditJson: audit ? paths.audit : null,
    factsJson: facts ? paths.facts : null,
    defenseMd: defense ? paths.defense : null,
    resumes,
    validation,
  };
}

/**
 * Возвращает статус этапа по id.
 *
 * @param stages - итоги этапов
 * @param id - id этапа
 * @returns статус или undefined
 */
function stageStatus(stages: PipelineStageResult[], id: StageId): StageStatus | undefined {
  return stages.find((stage) => stage.id === id)?.status;
}

/**
 * Вычисляет итоговый статус прогона.
 *
 * @param stages - итоги этапов
 * @returns success, partial или failed
 */
function computeOverallStatus(stages: PipelineStageResult[]): PipelineResult["overallStatus"] {
  if (stageStatus(stages, "1") === "failed" || stageStatus(stages, "3") === "failed") {
    return "failed";
  }

  const failed = stages.some((stage) => stage.status === "failed");
  const llmSkipped = (["2", "7", "8"] as StageId[]).some((id) => stageStatus(stages, id) === "skipped");

  return failed || llmSkipped ? "partial" : "success";
}

/**
 * Запускает конвейер целиком: этапы 1-8 с фиксацией итогов и артефактов.
 * Исключения этапов не пробрасывает: они попадают в stages[].error.
 *
 * @param params - workspace, вход, LLM-клиент, конфиги и дата
 * @returns итог прогона
 */
export async function runPipeline(params: PipelineParams): Promise<PipelineResult> {
  const startedAt = new Date().toISOString();
  const ctx: RunContext = {
    params,
    paths: workspacePaths(params.workspaceDir),
    stages: [],
    noLlm: params.skipLlmStages === true || params.llmClient === null,
  };

  await runFilesStage(ctx);
  const claims = await runClaimsStage(ctx);
  await runAuditStage(ctx, claims?.claims ?? []);
  await runFactsStage(ctx);
  recordEmbeddedStages(ctx);
  const generation = await runGenerationStage(ctx);
  await runVerificationStage(ctx, generation?.generated.map((entry) => entry.versionId) ?? []);
  const artifacts = await collectArtifacts(ctx.paths);

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    stages: ctx.stages,
    artifacts,
    overallStatus: computeOverallStatus(ctx.stages),
  };
}
