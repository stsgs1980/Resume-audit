import type { Facts } from "../../schemas/facts";
import { factsSchema } from "../../schemas/facts";
import { readJson, writeJsonAtomic } from "../../server/storage/files";
import type { OpenQuestion } from "../stage3/types";
import type { Answer, Stage4Warning } from "./types";

/** Валюты, распознаваемые в свободном ответе. */
const CURRENCIES = ["RUB", "USD", "EUR"] as const;

/**
 * Находит результаты по relatedClaimIds (id, evidence_id или source_claim_id).
 *
 * @param facts - факты
 * @param question - вопрос
 * @returns индексы [job, result]
 */
function findTargets(facts: Facts, question: OpenQuestion): Array<{ jobIndex: number; resultIndex: number }> {
  const targets: Array<{ jobIndex: number; resultIndex: number }> = [];
  const wanted = new Set(question.relatedClaimIds);

  facts.jobs.forEach((job, jobIndex) => {
    (job.results ?? []).forEach((result, resultIndex) => {
      if (
        wanted.has(result.id) ||
        wanted.has(result.evidence_id) ||
        (result.source_claim_id !== undefined && wanted.has(result.source_claim_id))
      ) {
        targets.push({ jobIndex, resultIndex });
      }
    });
  });

  return targets;
}

/**
 * Ищет валюту в свободном тексте ответа.
 *
 * @param freeText - ответ кандидата
 * @returns валюта или null
 */
function detectCurrency(freeText: string): (typeof CURRENCIES)[number] | null {
  const upper = freeText.toUpperCase();

  for (const currency of CURRENCIES) {
    if (upper.includes(currency)) {
      return currency;
    }
  }

  return null;
}

/**
 * Применяет ответ к facts.json. Неотвеченное не меняет ничего.
 *
 * @param question - вопрос этапа 4
 * @param answer - ответ кандидата
 * @param factsPath - путь к facts.json
 * @returns изменились ли факты и предупреждения
 */
export async function applyAnswer(
  question: OpenQuestion,
  answer: Answer,
  factsPath: string,
): Promise<{ factsChanged: boolean; warnings: Stage4Warning[] }> {
  const warnings: Stage4Warning[] = [];

  if (answer.status !== "answered") {
    return { factsChanged: false, warnings };
  }

  const facts = await readJson(factsPath, factsSchema);
  const targets = findTargets(facts, question);

  if (targets.length === 0) {
    warnings.push({ code: "fact_not_found", message: `Факт не найден: ${question.id}` });

    return { factsChanged: false, warnings };
  }

  const freeText = (answer.freeText ?? "").toLowerCase();
  let changed = false;

  const setStatus = (status: "confirmed" | "remove"): void => {
    for (const { jobIndex, resultIndex } of targets) {
      const result = facts.jobs[jobIndex]?.results?.[resultIndex];

      if (result !== undefined && result.status !== status) {
        result.status = status;
        changed = true;
      }
    }
  };

  if (question.type === "missing_evidence") {
    setStatus("confirmed");
  } else if (question.type === "contradiction") {
    if (freeText.includes("удалить")) {
      setStatus("remove");
    } else {
      setStatus("confirmed");
    }
  } else if (question.type === "currency_missing") {
    const currency = detectCurrency(answer.freeText ?? "");

    if (currency !== null) {
      for (const { jobIndex, resultIndex } of targets) {
        const result = facts.jobs[jobIndex]?.results?.[resultIndex];

        if (result !== undefined) {
          result.currency = currency;
          changed = true;
        }
      }
    }
  } else if (question.type === "target_vs_measured") {
    if (freeText.includes("target") || freeText.includes("целев")) {
      setStatus("remove");
    } else {
      setStatus("confirmed");
    }
  } else {
    warnings.push({ code: "explained", message: `Объяснено пользователем: ${question.id}` });
  }

  if (changed) {
    await writeJsonAtomic(factsPath, facts);
  }

  return { factsChanged: changed, warnings };
}
