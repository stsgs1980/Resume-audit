import { dirname, join } from "node:path";
import type { RunContext, StageOutcome } from "./run-context";
import { addSkipped, executeStage, hasStageStatus, joinErrors, plural, requireLlm } from "./run-context";
import { ensureLocked } from "./stage7/check-lock";
import { runStage7 } from "./stage7/index";
import type { Stage7Result } from "./stage7/types";
import { runStage8 } from "./stage8/index";
import type { Stage8Result } from "./stage8/types";

/**
 * Запускает этап 7 при наличии locked facts.
 *
 * @param ctx - контекст прогона
 * @returns итог этапа или null
 */
export async function runGenerationStage(ctx: RunContext): Promise<Stage7Result | null> {
  if (ctx.noLlm) {
    addSkipped(ctx, "7", "LLM-этап пропущен");

    return null;
  }

  if (!hasStageStatus(ctx, "4", "completed")) {
    addSkipped(ctx, "7", "facts.json не записан");

    return null;
  }

  if (ctx.params.requireLockForStage7 !== false) {
    const lock = await ensureLocked(ctx.paths.lock);

    if (!lock.ok) {
      addSkipped(ctx, "7", lock.reason ?? "facts.json не locked");

      return null;
    }
  }

  return executeStage(ctx, "7", "Генерация резюме...", async () => {
    const result = await runStage7({
      factsPath: ctx.paths.facts,
      lockPath: ctx.paths.lock,
      rolesConfigDir: dirname(ctx.params.rolesConfigPath),
      resumesDir: ctx.paths.resumesDir,
      defensePath: ctx.paths.defense,
      llmClient: requireLlm(ctx),
      promptConfig: ctx.params.promptConfig,
      modelId: ctx.params.modelId,
    });
    const failed = result.errors.length > 0;

    return {
      status: failed ? "failed" : "completed",
      summary: `${result.generated.length} резюме сгенерировано`,
      error: failed ? joinErrors(result.errors.map((entry) => `${entry.roleId}: ${entry.reason}`)) : undefined,
      warnings: result.warnings.map((warning) => `${warning.code}: ${warning.message}`),
      value: result,
    };
  });
}

/**
 * Преобразует итог этапа 8 в статус, сводку и ошибку.
 *
 * @param result - итог верификации
 * @returns итог этапа
 */
function verificationOutcome(result: Stage8Result): StageOutcome<Stage8Result> {
  const blockedEntries = result.validated.filter((entry) => entry.blocked);
  const blocked = blockedEntries.length;
  const failed = result.errors.length > 0 || result.exportBlocked;
  const blockedReasons = blockedEntries.map(
    (entry) => `${entry.versionId}: экспорт заблокирован (${entry.blockReasons.join("; ")})`,
  );

  return {
    status: failed ? "failed" : "completed",
    summary:
      `${result.validated.length} ${plural(result.validated.length, "версия", "версии", "версий")}, ` +
      `${blocked} ${plural(blocked, "блокировка", "блокировки", "блокировок")}`,
    error: failed
      ? joinErrors([...result.errors.map((entry) => `${entry.versionId}: ${entry.reason}`), ...blockedReasons])
      : undefined,
    warnings: result.warnings.map((warning) => `${warning.code}: ${warning.message}`),
    value: result,
  };
}

/**
 * Запускает этап 8 при наличии locked facts и свежих резюме.
 *
 * @param ctx - контекст прогона
 * @param generatedVersionIds - id резюме из текущего прогона
 * @returns итог этапа или null
 */
export async function runVerificationStage(
  ctx: RunContext,
  generatedVersionIds: string[],
): Promise<Stage8Result | null> {
  if (ctx.noLlm) {
    addSkipped(ctx, "8", "LLM-этап пропущен");

    return null;
  }

  if (!hasStageStatus(ctx, "7", "completed")) {
    addSkipped(ctx, "8", "этап 7 не завершён");

    return null;
  }

  if (generatedVersionIds.length === 0) {
    addSkipped(ctx, "8", "нет свежих резюме");

    return null;
  }

  const lock = await ensureLocked(ctx.paths.lock);

  if (!lock.ok) {
    addSkipped(ctx, "8", lock.reason ?? "facts.json не locked");

    return null;
  }

  return executeStage(ctx, "8", "Верификация...", async () => {
    const result = await runStage8({
      factsPath: ctx.paths.facts,
      lockPath: ctx.paths.lock,
      resumesDir: ctx.paths.resumesDir,
      validationDir: ctx.paths.validationDir,
      evidenceDir: join(ctx.params.workspaceDir, "evidence"),
      rolesConfigPath: ctx.params.rolesConfigPath,
      llmClient: requireLlm(ctx),
      promptConfig: ctx.params.promptConfig,
      modelId: ctx.params.modelId,
      versionIds: generatedVersionIds,
    });
    return verificationOutcome(result);
  });
}
