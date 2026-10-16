import type { ResumeResponse } from "../../llm/schemas";
import type { Facts } from "../../schemas/facts";

/**
 * Собирает все fact_id резюме.
 *
 * @param resume - документ резюме
 * @returns fact_id из results всех jobs
 */
function collectFactIds(resume: ResumeResponse): string[] {
  return resume.jobs.flatMap((job) => job.results.map((result) => result.fact_id));
}

/**
 * Проверяет наличие каждого fact_id резюме в facts.
 *
 * @param resume - документ резюме
 * @param facts - факты из facts.json
 * @returns неизвестные fact_id
 */
export function validateFactIds(resume: ResumeResponse, facts: Facts): string[] {
  const known = new Set<string>();

  for (const job of facts.jobs) {
    for (const result of job.results ?? []) {
      known.add(result.id);
      known.add(result.evidence_id);
    }
  }

  return collectFactIds(resume).filter((factId) => !known.has(factId));
}

/**
 * Проверяет оговорки: hedge_required факт обязан иметь hedge_present.
 *
 * @param resume - документ резюме
 * @param facts - факты из facts.json
 * @returns fact_id без обязательной оговорки
 */
export function validateHedge(resume: ResumeResponse, facts: Facts): string[] {
  const required = new Map<string, string>();

  for (const job of facts.jobs) {
    for (const result of job.results ?? []) {
      if (result.hedge_required) {
        required.set(result.id, result.id);
        required.set(result.evidence_id, result.id);
      }
    }
  }

  const missing: string[] = [];

  for (const job of resume.jobs) {
    for (const result of job.results) {
      if (required.has(result.fact_id) && !result.hedge_present) {
        missing.push(result.fact_id);
      }
    }
  }

  return missing;
}
