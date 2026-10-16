import { parseNumber } from "../../core/numbers";
import { extractNumbers, verify } from "../../core/verification";
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
 * Собирает числа фактов: id, значение, роли.
 *
 * @param facts - факты из facts.json
 * @returns числа фактов
 */
function collectFactsNumbers(facts: Facts): Array<{ factId: string; value: number; roles: string[] }> {
  const numbers: Array<{ factId: string; value: number; roles: string[] }> = [];

  for (const job of facts.jobs) {
    for (const result of job.results ?? []) {
      if (result.number !== null) {
        numbers.push({ factId: result.id, value: result.number, roles: result.roles });
      }
    }
  }

  return numbers;
}

/**
 * Проверяет числа резюме по фактам и роли. Исключения ядра
 * (телефоны, годы, версии) возвращает отдельно, не ошибками.
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

  for (const token of extractNumbers(resumeText)) {
    const parsed = parseNumber(token);

    if (parsed === null) {
      errors.push({ number: token, factId: null, reason: "число не распознано" });

      continue;
    }

    const fact = factsNumbers.find((entry) => entry.value === parsed.value);

    if (fact === undefined) {
      errors.push({ number: token, factId: null, reason: "unsupported_number: числа нет в facts.json" });

      continue;
    }

    if (!fact.roles.includes(roleId)) {
      errors.push({
        number: token,
        factId: fact.factId,
        reason: `wrong_role: число не для роли "${roleId}"`,
      });
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
