import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LlmClient } from "../../llm/client";
import type { ExtractionResponse } from "../../llm/schemas";
import type { LlmCallResult } from "../../llm/types";
import type { PipelineParams, PipelineResult, StageStatus } from "../run";
import { runPipeline } from "../run";
import { rawClaims, resumeText, rolesPayload } from "./pipeline-fixtures";

/** Подтверждённый навык для валидного резюме. */
const skillClaim: ExtractionResponse["claims"][number] = {
  statement: "SQL",
  quote: "Владею SQL",
  source_file: "resume.txt",
  category: "skill",
  metric_type: "",
  number: null,
  currency: null,
  status: "confirmed",
  reason: "",
};

/** Утверждения полного прогона: employment, result, skill. */
export const runClaims: ExtractionResponse["claims"] = [...rawClaims, skillClaim];

/** Заголовки ролей из config/roles/sales.json. */
const ROLE_TITLES: Record<string, string> = {
  generation_sales: "Руководитель отдела продаж",
  generation_salesops: "Руководитель Sales Operations",
  generation_aipo: "AI Product Owner",
};

/**
 * Валидное резюме для роли, определяемой по stage генерации.
 *
 * @param stage - stage вызова LLM вида generation_<role>
 * @returns документ резюме
 */
export const validDocument = (stage?: string): Record<string, unknown> => ({
  title: ROLE_TITLES[stage ?? ""] ?? ROLE_TITLES["generation_sales"],
  specialization: "Продажи",
  employment_type: "Полная занятость",
  work_format: "Офис",
  experience_total: "1 год",
  experience_as_of: "2026-10-20",
  about: "Опыт в продажах.",
  jobs: [
    {
      job_id: "job1",
      company: "Ромашка",
      industry: "Ритейл",
      position: "Руководитель",
      period: "2020-01 - 2021-01",
      duration: "1 год",
      context: "Оптовые продажи",
      actions: ["Развитие каналов"],
      results: [{ text: "Выручка выросла", fact_id: "res1", hedge_present: false }],
      total_experience_inconsistent: false,
      total_experience_note: "",
    },
  ],
  skills: [{ skill: "SQL", skill_id: "sk1" }],
  languages: [],
});

/** Опции mock-клиента. */
interface ClientOptions {
  /** Документ генерации по stage. */
  document?: (stage?: string) => Record<string, unknown>;
  /** Утверждения этапа 2. */
  claims?: ExtractionResponse["claims"];
  /** Вернуть ошибку на этапе оценки ролей. */
  failRoles?: boolean;
  /** Stages, на которых клиент возвращает ошибку. */
  failStages?: string[];
}

/**
 * Mock-клиент полного прогона: extraction, roles, generation, verification.
 *
 * @param options - документ генерации и утверждения
 * @returns клиент
 */
export const fullClient = (options: ClientOptions = {}): LlmClient => {
  const document = options.document ?? validDocument;
  const claims = options.claims ?? runClaims;

  return {
    health: () => Promise.resolve(true),
    call: <T>(callParams: { stage?: string }): Promise<LlmCallResult<T>> => {
      if (callParams.stage !== undefined && options.failStages?.includes(callParams.stage) === true) {
        return Promise.resolve({ ok: false, error: { kind: "unavailable", message: `${callParams.stage} failed` } });
      }

      if (callParams.stage === "roles") {
        if (options.failRoles === true) {
          return Promise.resolve({ ok: false, error: { kind: "unavailable", message: "roles failed" } });
        }

        return Promise.resolve({ ok: true, data: rolesPayload as unknown as T });
      }

      if (callParams.stage?.startsWith("generation_") === true) {
        return Promise.resolve({ ok: true, data: document(callParams.stage) as unknown as T });
      }

      if (callParams.stage === "verification") {
        return Promise.resolve({
          ok: true,
          data: { checks: [], unsupported_skills: [], forbidden_words_found: [] } as unknown as T,
        });
      }

      return Promise.resolve({ ok: true, data: { claims } as unknown as T });
    },
  };
};

/**
 * Базовые параметры прогона.
 *
 * @param dir - временная директория теста
 * @param llmClient - клиент или null
 * @param skipLlmStages - пропустить LLM-этапы
 * @returns параметры
 */
export const baseParams = (dir: string, llmClient: LlmClient | null, skipLlmStages?: boolean): PipelineParams => ({
  workspaceDir: join(dir, "workspace"),
  inputDir: join(dir, "workspace", "input"),
  llmClient,
  promptConfig: { promptsDir: "config/prompts" },
  rolesConfigPath: "config/roles/sales.json",
  modelId: "mock/model",
  auditDate: "2026-10-20",
  skipLlmStages,
  onProgress: () => undefined,
});

/**
 * Создаёт workspace с одним текстовым файлом.
 *
 * @param dir - временная директория теста
 * @returns void
 */
export const setupInput = async (dir: string): Promise<void> => {
  await mkdir(join(dir, "workspace", "input"), { recursive: true });
  await writeFile(join(dir, "workspace", "input", "resume.txt"), resumeText, "utf8");
};

/**
 * Проверяет существование файла.
 *
 * @param path - путь
 * @returns true, если файл доступен
 */
export const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);

    return true;
  } catch {
    return false;
  }
};

/**
 * Статус этапа по id.
 *
 * @param result - итог конвейера
 * @param id - id этапа
 * @returns статус или undefined
 */
export const stageStatus = (result: PipelineResult, id: string): StageStatus | undefined =>
  result.stages.find((stage) => stage.id === id)?.status;

/**
 * Переводит facts.lock в locked.
 *
 * @param dir - временная директория теста
 * @returns void
 */
export const markLocked = async (dir: string): Promise<void> => {
  await writeFile(
    join(dir, "workspace", "facts.lock"),
    JSON.stringify({ state: "locked", lockedAt: new Date().toISOString() }),
    "utf8",
  );
};

/**
 * Прогоняет конвейер для записи facts.json и затем lock.
 *
 * @param dir - временная директория теста
 * @returns void
 */
export const prepareLockedFacts = async (dir: string): Promise<void> => {
  await runPipeline(baseParams(dir, fullClient()));
  await markLocked(dir);
};
