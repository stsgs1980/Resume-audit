import { join } from "node:path";
import type { LlmClient } from "../llm/client";
import type { PipelineParams, PipelineStageResult, StageId, StageStatus, WorkspacePaths } from "./run-types";

/** Названия этапов для отчёта. */
const STAGE_NAMES: Record<StageId, string> = {
  "1": "Файлы",
  "2": "Утверждения",
  "3": "Аудит",
  "4": "Факты",
  "5": "Роли",
  "6": "ATS",
  "7": "Генерация",
  "8": "Верификация",
};

/** Контекст одного прогона. */
export interface RunContext {
  /** Параметры прогона. */
  params: PipelineParams;
  /** Пути workspace. */
  paths: WorkspacePaths;
  /** Накопленные итоги этапов. */
  stages: PipelineStageResult[];
  /** LLM-этапы отключены. */
  noLlm: boolean;
}

/** Счётчики этапа 3. */
export interface AuditStageInfo {
  /** Число противоречий. */
  contradictions: number;
  /** Число открытых вопросов. */
  openQuestions: number;
}

/** Итог внутреннего шага этапа. */
export interface StageOutcome<T> {
  /** Статус этапа. */
  status: StageStatus;
  /** Сводка. */
  summary: string;
  /** Ошибка для failed. */
  error?: string;
  /** Предупреждения этапа. */
  warnings?: string[];
  /** Результат этапа. */
  value: T;
}

/**
 * Собирает пути артефактов workspace.
 *
 * @param workspaceDir - директория workspace
 * @returns пути артефактов
 */
export function workspacePaths(workspaceDir: string): WorkspacePaths {
  return {
    files: join(workspaceDir, "files.json"),
    claims: join(workspaceDir, "claims.json"),
    audit: join(workspaceDir, "audit.json"),
    facts: join(workspaceDir, "facts.json"),
    lock: join(workspaceDir, "facts.lock"),
    resumesDir: join(workspaceDir, "resumes"),
    validationDir: join(workspaceDir, "validation"),
    defense: join(workspaceDir, "interview-defense.md"),
  };
}

/**
 * Подбирает форму слова по числу.
 *
 * @param count - число
 * @param one - форма для 1
 * @param few - форма для 2-4
 * @param many - форма для остальных
 * @returns выбранная форма
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }

  return many;
}

/**
 * Склеивает ошибки в одну строку.
 *
 * @param items - тексты ошибок
 * @returns строка или undefined
 */
export function joinErrors(items: string[]): string | undefined {
  return items.length === 0 ? undefined : items.join("; ");
}

/**
 * Добавляет итог этапа.
 *
 * @param ctx - контекст прогона
 * @param id - id этапа
 * @param status - статус
 * @param startedMs - время старта
 * @param summary - сводка
 * @param error - ошибка
 * @param warnings - предупреждения
 * @returns void
 */
function addStage(
  ctx: RunContext,
  id: StageId,
  status: StageStatus,
  startedMs: number,
  summary: string,
  error?: string,
  warnings: string[] = [],
): void {
  ctx.stages.push({
    id,
    name: STAGE_NAMES[id],
    status,
    durationMs: Date.now() - startedMs,
    summary,
    ...(error === undefined ? {} : { error }),
    warnings,
  });
}

/**
 * Добавляет пропущенный этап.
 *
 * @param ctx - контекст прогона
 * @param id - id этапа
 * @param reason - причина пропуска
 * @returns void
 */
export function addSkipped(ctx: RunContext, id: StageId, reason: string): void {
  addStage(ctx, id, "skipped", Date.now(), reason);
}

/**
 * Добавляет завершённый этап без отдельного результата.
 *
 * @param ctx - контекст прогона
 * @param id - id этапа
 * @param summary - сводка
 * @returns void
 */
export function addCompleted(ctx: RunContext, id: StageId, summary: string): void {
  addStage(ctx, id, "completed", Date.now(), summary);
}

/**
 * Проверяет, завершился ли этап с указанным статусом.
 *
 * @param ctx - контекст прогона
 * @param id - id этапа
 * @param status - ожидаемый статус
 * @returns true, если этап уже записан с этим статусом
 */
export function hasStageStatus(ctx: RunContext, id: StageId, status: StageStatus): boolean {
  return ctx.stages.some((stage) => stage.id === id && stage.status === status);
}

/**
 * Выполняет этап с перехватом неожиданных исключений.
 *
 * @param ctx - контекст прогона
 * @param id - id этапа
 * @param progressMessage - сообщение прогресса или null
 * @param task - работа этапа
 * @returns результат этапа или null при исключении
 */
export async function executeStage<T>(
  ctx: RunContext,
  id: StageId,
  progressMessage: string | null,
  task: () => Promise<StageOutcome<T>>,
): Promise<T | null> {
  const startedMs = Date.now();

  if (progressMessage !== null) {
    try {
      ctx.params.onProgress?.(id, progressMessage);
    } catch {
      // Колбэк прогресса не должен ломать этап.
    }
  }

  try {
    const outcome = await task();

    addStage(ctx, id, outcome.status, startedMs, outcome.summary, outcome.error, outcome.warnings);

    return outcome.value;
  } catch (error) {
    addStage(ctx, id, "failed", startedMs, "Ошибка этапа", (error as Error).message);

    return null;
  }
}

/**
 * Возвращает LLM-клиент или бросает ошибку при его отсутствии.
 *
 * @param ctx - контекст прогона
 * @returns клиент
 */
export function requireLlm(ctx: RunContext): LlmClient {
  if (ctx.params.llmClient === null) {
    throw new Error("LLM client is not configured");
  }

  return ctx.params.llmClient;
}
