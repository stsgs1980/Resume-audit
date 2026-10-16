import { readFileSync } from "node:fs";
import { detectForbiddenWords, detectPlaceholders } from "../../core/detectors";
import { extractNumbers } from "../../core/number-check";
import { parseNumber } from "../../core/numbers";
import { verifyRequiredFields, verifyShareSum, verifySkills } from "../../core/verification";
import type { ResumeResponse } from "../../llm/schemas";
import type { Facts } from "../../schemas/facts";
import { verifyNumbers } from "./layer1-numbers";
import type { ValidationLayer1 } from "./types";

/**
 * Читает JSON-конфиг синхронно, при ошибке возвращает fallback.
 *
 * @param configPath - путь к конфигу
 * @param fallback - значение при ошибке
 * @returns распарсенный конфиг или fallback
 */
function readConfig<T>(configPath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/**
 * Собирает весь текст резюме для поиска слов и плейсхолдеров.
 *
 * @param resume - документ резюме
 * @returns полный текст
 */
function collectFullText(resume: ResumeResponse): string {
  const parts = [resume.title, resume.specialization, resume.about];

  for (const job of resume.jobs) {
    parts.push(job.company, job.position, job.context, ...job.actions);

    for (const result of job.results) {
      parts.push(result.text);
    }
  }

  for (const entry of resume.skills) {
    parts.push(entry.skill);
  }

  return parts.join("\n");
}

/**
 * Проверяет заголовок: без слэша, соответствует цели из конфига роли.
 *
 * @param resume - документ резюме
 * @param roleId - целевая роль
 * @param rolesConfigPath - путь к конфигу роли
 * @returns true, если заголовок корректен
 */
function checkTitle(resume: ResumeResponse, roleId: string, rolesConfigPath: string): boolean {
  if (resume.title.includes("/")) {
    return false;
  }

  const config = readConfig<{ targets?: Array<{ id: string; title: string }> }>(rolesConfigPath, {});
  const target = config.targets?.find((entry) => entry.id === roleId);

  if (target === undefined) {
    return false;
  }

  const resumeTitle = resume.title.toLowerCase();
  const targetTitle = target.title.toLowerCase();

  return resumeTitle === targetTitle || resumeTitle.includes(targetTitle) || targetTitle.includes(resumeTitle);
}

/**
 * Собирает значения target_metrics портфельных проектов.
 *
 * @param facts - факты из facts.json
 * @returns числовые значения целевых метрик
 */
function collectTargetMetricValues(facts: Facts): number[] {
  const values: number[] = [];

  for (const project of facts.portfolio_projects ?? []) {
    const metrics = (project as unknown as Record<string, unknown>)["target_metrics"];

    if (!Array.isArray(metrics)) {
      continue;
    }

    for (const metric of metrics) {
      if (typeof metric === "number" && Number.isFinite(metric)) {
        values.push(metric);
      } else if (metric !== null && typeof metric === "object") {
        const value = (metric as Record<string, unknown>)["number"];

        if (typeof value === "number" && Number.isFinite(value)) {
          values.push(value);
        }
      } else if (typeof metric === "string") {
        const parsed = parseNumber(metric);

        if (parsed !== null) {
          values.push(parsed.value);
        }
      }
    }
  }

  return values;
}

/**
 * Ищет числа target_metrics в блоке результатов резюме.
 *
 * @param resume - документ резюме
 * @param targetValues - значения целевых метрик
 * @returns токены чисел, совпавших с целевыми метриками
 */
function findTargetMetricsInResults(resume: ResumeResponse, targetValues: number[]): string[] {
  if (targetValues.length === 0) {
    return [];
  }

  const found: string[] = [];

  for (const job of resume.jobs) {
    for (const result of job.results) {
      for (const token of extractNumbers(result.text)) {
        const parsed = parseNumber(token);

        if (parsed !== null && targetValues.includes(parsed.value)) {
          found.push(token);
        }
      }
    }
  }

  return found;
}

/**
 * Слой 1: детерминированная проверка версии по фактам, конфигам и роли.
 *
 * @param resume - документ резюме
 * @param facts - факты из facts.json
 * @param roleId - целевая роль
 * @param rolesConfigPath - путь к конфигу роли
 * @returns итог слоя 1
 */
export function verifyLayer1(
  resume: ResumeResponse,
  facts: Facts,
  roleId: string,
  rolesConfigPath: string,
): ValidationLayer1 {
  const { errors: numberErrors, exceptions } = verifyNumbers(resume, facts, roleId);
  const fullText = collectFullText(resume);
  const forbidden = readConfig<{ global?: string[] }>("config/forbidden-words.json", {});
  const placeholders = readConfig<{ patterns?: string[] }>("config/placeholders.json", {});
  const skillErrors = verifySkills(
    resume.skills.map((entry) => entry.skill),
    facts.confirmed_skills.map((entry) => ({ skill: entry.skill, roles: entry.roles })),
    roleId,
  );
  const required = verifyRequiredFields({
    title: resume.title,
    specialization: resume.specialization,
    employment_type: resume.employment_type,
    work_format: resume.work_format,
    experience_total: resume.experience_total,
    about: resume.about,
  });

  if (resume.jobs.length === 0) {
    required.push("jobs");
  }

  if (resume.skills.length === 0) {
    required.push("skills");
  }

  const hedgeRequired = new Map<string, string>();

  for (const job of facts.jobs) {
    for (const result of job.results ?? []) {
      if (result.hedge_required) {
        hedgeRequired.set(result.id, result.id);
        hedgeRequired.set(result.evidence_id, result.id);
      }
    }
  }

  const hedgeErrors: string[] = [];

  for (const job of resume.jobs) {
    for (const result of job.results) {
      if (hedgeRequired.has(result.fact_id) && !result.hedge_present) {
        hedgeErrors.push(result.fact_id);
      }
    }
  }

  return {
    numberErrors,
    skillErrors,
    forbiddenFound: detectForbiddenWords(fullText, forbidden.global ?? []),
    placeholdersFound: detectPlaceholders(fullText, placeholders.patterns ?? []),
    titleOk: checkTitle(resume, roleId, rolesConfigPath),
    requiredFieldsMissing: required,
    hedgeErrors,
    targetMetricsInResults: findTargetMetricsInResults(resume, collectTargetMetricValues(facts)),
    shareSumOk: verifyShareSum(facts.meta.targets.map((entry) => entry.share_of_applications)),
    exceptions,
  };
}
