import { basename, relative, resolve } from "node:path";
import type { PipelineArtifacts, PipelineResult, PipelineStageResult, StageStatus } from "../src/pipeline/run-types";

/** Метки статусов этапов. */
const TAGS: Record<StageStatus, string> = { completed: "[OK]", skipped: "[SKIP]", failed: "[FAIL]" };

/**
 * Печатает заголовок прогона.
 *
 * @param workspaceDir - директория workspace
 * @param inputDir - директория входа
 * @param auditDate - дата аудита
 * @returns void
 */
export function printHeader(workspaceDir: string, inputDir: string, auditDate: string): void {
  console.log("Resume Audit Pipeline");
  console.log(`Workspace: ${workspaceDir}`);
  console.log(`Input: ${resolve(inputDir)}`);
  console.log(`Audit date: ${auditDate}`);
  console.log("");
}

/**
 * Печатает таблицу этапов.
 *
 * @param stages - итоги этапов
 * @returns void
 */
export function printStages(stages: PipelineStageResult[]): void {
  for (const stage of stages) {
    const label = `[${stage.id}/8] ${stage.name}...`.padEnd(28, " ");

    console.log(`${label}${stage.summary.padEnd(34, " ")}${TAGS[stage.status]}`);

    if (stage.error !== undefined) {
      console.log(`         ${stage.error}`);
    }

    for (const warning of stage.warnings) {
      console.log(`         [WARN] ${warning}`);
    }
  }

  console.log("");
}

/**
 * Печатает список артефактов.
 *
 * @param workspaceDir - директория workspace
 * @param artifacts - артефакты прогона
 * @returns void
 */
export function printArtifacts(workspaceDir: string, artifacts: PipelineArtifacts): void {
  console.log(`Результаты: ${workspaceDir}`);

  const files = [
    artifacts.filesJson,
    artifacts.claimsJson,
    artifacts.auditJson,
    artifacts.factsJson,
    artifacts.defenseMd,
  ];

  for (const file of files) {
    if (file !== null) {
      console.log(`  ${relative(workspaceDir, file)}`);
    }
  }

  if (artifacts.resumes.length > 0) {
    console.log(`  resumes/${artifacts.resumes.map((path) => basename(path)).join(", ")}`);
  }

  if (artifacts.validation.length > 0) {
    console.log("  validation/");
  }

  console.log("");
}

/**
 * Печатает длительность и статус.
 *
 * @param result - итог прогона
 * @returns void
 */
export function printFooter(result: PipelineResult): void {
  const durationMs = Date.parse(result.finishedAt) - Date.parse(result.startedAt);

  console.log(`Длительность: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`Статус: ${result.overallStatus}`);
}
