import { join } from "node:path";
import { factsSchema } from "../schemas/facts";
import { fileExists, readJson } from "../server/storage/files";
import type { AuditStageInfo, RunContext } from "./run-context";
import { addSkipped, executeStage, hasStageStatus, joinErrors, plural, requireLlm } from "./run-context";
import { runStage1 } from "./stage1/index";
import type { Stage1Result } from "./stage1/types";
import { runStage2 } from "./stage2/index";
import type { Claim, ClaimsResult } from "./stage2/types";
import { runStage3, runStage3a } from "./stage3/index";
import type { AuditWarning } from "./stage3/types";
import { runStage4a } from "./stage4/index";
import type { Stage4aResult } from "./stage4/types";
import { ensureLocked } from "./stage7/check-lock";

/**
 * Запускает этап 1.
 *
 * @param ctx - контекст прогона
 * @returns итог этапа или null
 */
export async function runFilesStage(ctx: RunContext): Promise<Stage1Result | null> {
  return executeStage(ctx, "1", "Чтение файлов...", async () => {
    const result = await runStage1({ rootDir: ctx.params.inputDir, outputPath: ctx.paths.files });

    return {
      status: result.errors.length === 0 ? "completed" : "failed",
      summary: `${result.totalFiles} ${plural(result.totalFiles, "файл", "файла", "файлов")} прочитано`,
      error: joinErrors(result.errors.map((entry) => `${entry.path}: ${entry.reason}`)),
      warnings: result.warnings,
      value: result,
    };
  });
}

/**
 * Запускает этап 2 или фиксирует пропуск.
 *
 * @param ctx - контекст прогона
 * @returns итог этапа или null
 */
export async function runClaimsStage(ctx: RunContext): Promise<ClaimsResult | null> {
  if (ctx.noLlm) {
    addSkipped(ctx, "2", "LLM-этап пропущен");

    return null;
  }

  if (!hasStageStatus(ctx, "1", "completed")) {
    addSkipped(ctx, "2", "этап 1 не завершён");

    return null;
  }

  return executeStage(ctx, "2", "Извлечение утверждений...", async () => {
    const result = await runStage2({
      filesPath: ctx.paths.files,
      claimsPath: ctx.paths.claims,
      llmClient: requireLlm(ctx),
      promptConfig: ctx.params.promptConfig,
      partialDir: join(ctx.params.workspaceDir, "partial"),
    });

    return {
      status: result.errors.length === 0 ? "completed" : "failed",
      summary: `${result.totalClaims} claims извлечено`,
      error: joinErrors(result.errors.map((entry) => `${entry.file}: ${entry.reason}`)),
      warnings: result.warnings,
      value: result,
    };
  });
}

/**
 * Проверяет, есть ли в warnings фатальная ошибка этапа 3.
 *
 * @param warnings - предупреждения
 * @returns true для stage3_error или audit_schema_mismatch
 */
function hasAuditFailure(warnings: AuditWarning[]): boolean {
  return warnings.some((warning) => warning.kind === "stage3_error" || warning.kind === "audit_schema_mismatch");
}

/**
 * Запускает этап 3: 3a без LLM или полный 3a+3b.
 *
 * @param ctx - контекст прогона
 * @param claims - утверждения этапа 2
 * @returns счётчики аудита или null
 */
export async function runAuditStage(ctx: RunContext, claims: Claim[]): Promise<AuditStageInfo | null> {
  if (!hasStageStatus(ctx, "1", "completed")) {
    addSkipped(ctx, "3", "этап 1 не завершён");

    return null;
  }

  return executeStage(ctx, "3", "Детерминированный аудит...", async () => {
    const base = {
      claimsPath: ctx.paths.claims,
      factsPath: ctx.paths.facts,
      auditPath: ctx.paths.audit,
      claims,
      auditDate: ctx.params.auditDate,
      roles: [],
    };
    const audit = ctx.noLlm
      ? await runStage3a(base)
      : await runStage3({
          ...base,
          rolesConfigPath: ctx.params.rolesConfigPath,
          llmClient: requireLlm(ctx),
          promptConfig: ctx.params.promptConfig,
          vacancyText: null,
        });
    const failed = hasAuditFailure(audit.warnings);
    const openQuestions = "openQuestions" in audit ? audit.openQuestions : audit.open_questions;

    return {
      status: failed ? "failed" : "completed",
      summary:
        `${audit.contradictions.length} ` +
        `${plural(audit.contradictions.length, "противоречие", "противоречия", "противоречий")}, ` +
        `${openQuestions.length} ${plural(openQuestions.length, "вопрос", "вопроса", "вопросов")}`,
      error: failed ? joinErrors(audit.warnings.map((warning) => warning.message)) : undefined,
      warnings: audit.warnings.map((warning) => warning.message),
      value: { contradictions: audit.contradictions.length, openQuestions: openQuestions.length },
    };
  });
}

/**
 * Фиксирует этапы 5 и 6: они выполняются внутри 3b.
 *
 * @param ctx - контекст прогона
 * @returns void
 */
export function recordEmbeddedStages(ctx: RunContext): void {
  addSkipped(ctx, "5", "(в составе этапа 3)");
  addSkipped(ctx, "6", "(в составе этапа 3)");
}

/**
 * Запускает этап 4a.
 *
 * @param ctx - контекст прогона
 * @returns итог этапа или null
 */
export async function runFactsStage(ctx: RunContext): Promise<Stage4aResult | null> {
  if (!hasStageStatus(ctx, "1", "completed")) {
    addSkipped(ctx, "4", "этап 1 не завершён");

    return null;
  }

  const lock = await ensureLocked(ctx.paths.lock);

  if (lock.ok && (await fileExists(ctx.paths.facts))) {
    return executeStage(ctx, "4", null, async () => {
      try {
        await readJson(ctx.paths.facts, factsSchema);
      } catch (error) {
        return {
          status: "failed",
          summary: "facts.json не прошёл проверку схемы",
          error: `facts.json не соответствует схеме: ${(error as Error).message}`,
          value: null,
        };
      }

      return { status: "completed", summary: "facts.json уже locked", value: null };
    });
  }

  if (!ctx.noLlm && !hasStageStatus(ctx, "2", "completed")) {
    addSkipped(ctx, "4", "этап 2 не завершён");

    return null;
  }

  return executeStage(ctx, "4", "Формирование фактов...", async () => {
    const result = await runStage4a({
      claimsPath: ctx.paths.claims,
      factsPath: ctx.paths.facts,
      auditPath: ctx.paths.audit,
      lockPath: ctx.paths.lock,
      rolesConfigPath: ctx.params.rolesConfigPath,
      auditDate: ctx.params.auditDate,
      ...(ctx.params.storageConfig === undefined ? {} : { storageConfig: ctx.params.storageConfig }),
      ...(ctx.params.slug === undefined ? {} : { slug: ctx.params.slug }),
    });

    return {
      status: result.written ? "completed" : "failed",
      summary: result.written ? "facts.json записан" : "facts.json не записан",
      error: result.written ? undefined : joinErrors(result.warnings.map((warning) => warning.message)),
      warnings: result.warnings.map((warning) => `${warning.code}: ${warning.message}`),
      value: result,
    };
  });
}
