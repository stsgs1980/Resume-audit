import type { FactNumber } from "../../core/number-check";
import { verifyNumbers as checkCoreNumbers } from "../../core/number-check";
import { verify } from "../../core/verification";
import type { ResumeResponse } from "../../llm/schemas";
import type { Facts } from "../../schemas/facts";
import type { ValidationLayer1 } from "./types";

/**
 * Собирает текст для проверки чисел: title, about, тексты результатов.
 *
 * @param resume - документ резюме
 * @returns текст для извлечения чисел
 */
function collectNumberText(resume: ResumeResponse): string {
  const parts = [resume.title, resume.about];

  for (const job of resume.jobs) {
    for (const result of job.results) {
      parts.push(result.text);
    }
  }

  return parts.join("\n");
}

/**
 * Собирает числа фактов: id, значение, валюта, характер, роли.
 * Характер выводится из unit: единица с процентом — percent,
 * иначе — exact (старые факты без процента читаются как exact).
 * Отсутствующая валюта (старые facts.json) читается как null.
 *
 * @param facts - факты из facts.json
 * @returns числа фактов
 */
function collectFactsNumbers(facts: Facts): FactNumber[] {
  const numbers: FactNumber[] = [];

  for (const job of facts.jobs) {
    for (const result of job.results ?? []) {
      if (result.number !== null) {
        numbers.push({
          factId: result.id,
          value: result.number,
          currency: result.currency ?? null,
          qualifier: result.unit.includes("%") ? "percent" : "exact",
          roles: result.roles,
        });
      }
    }
  }

  return numbers;
}

/**
 * Проверяет числа резюме по фактам и роли через ядро.
 * Исключения ядра (телефоны, годы, версии) возвращает отдельно.
 * Warning-совпадения ядра (округление, неуказанная валюта)
 * ошибками не считаются.
 *
 * @param resume - документ резюме
 * @param facts - факты из facts.json
 * @param roleId - целевая роль
 * @returns ошибки и исключения
 */
export function verifyNumbers(
  resume: ResumeResponse,
  facts: Facts,
  roleId: string,
): { errors: ValidationLayer1["numberErrors"]; exceptions: string[] } {
  const resumeText = collectNumberText(resume);
  const factsNumbers = collectFactsNumbers(facts);
  const errors: ValidationLayer1["numberErrors"] = [];

  for (const checked of checkCoreNumbers(resumeText, factsNumbers, roleId)) {
    if (!checked.found) {
      errors.push({ number: checked.number, factId: checked.factId, reason: checked.reason });
    }
  }

  const exceptions = verify({
    resumeText,
    factsNumbers,
    resumeSkills: [],
    confirmedSkills: [],
    roleId,
    forbiddenWords: [],
    hedgeRequiredFactIds: [],
    factIdsWithHedge: [],
    requiredFields: {},
    targetShares: [],
  }).exceptions;

  return { errors, exceptions };
}
