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
 * Определяет интент свободного ответа по ключевым словам и отрицаниям.
 * "positive" — явное действие удаления («удалить» / «целевая»);
 * "negative" — факт сохраняется («не удалять» / «оставить» / «не целевая»);
 * "unclear" — ответ не распознан.
 *
 * @param freeText - текст ответа
 * @param questionType - тип вопроса
 * @returns интент ответа
 */
export function parseAnswerIntent(freeText: string, questionType: string): "positive" | "negative" | "unclear" {
  const text = freeText.toLowerCase().trim();

  if (text === "") {
    return "unclear";
  }

  if (questionType === "target_vs_measured") {
    if (/(?:^|\s)не\s*(?:целев|target)/u.test(text)) {
      return "negative";
    }

    if (text.includes("целев") || text.includes("target")) {
      return "positive";
    }

    return "unclear";
  }

  if (questionType === "contradiction") {
    if (/(?:^|\s)не\s*удал/u.test(text)) {
      return "negative";
    }

    if (text.includes("остав")) {
      return "negative";
    }

    if (text.includes("удал")) {
      return "positive";
    }

    return "unclear";
  }

  return "unclear";
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

  const freeText = answer.freeText ?? "";
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
  } else if (question.type === "contradiction" || question.type === "target_vs_measured") {
    const intent = parseAnswerIntent(freeText, question.type);

    if (intent === "unclear") {
      warnings.push({ code: "answer_unclear", message: `Ответ не распознан, требуется уточнение: ${question.id}` });
    } else {
      setStatus(intent === "positive" ? "remove" : "confirmed");
    }
  } else if (question.type === "currency_missing") {
    const currency = detectCurrency(freeText);

    if (currency === null) {
      warnings.push({ code: "answer_unclear", message: `Ответ не распознан, требуется уточнение: ${question.id}` });
    } else {
      for (const { jobIndex, resultIndex } of targets) {
        const result = facts.jobs[jobIndex]?.results?.[resultIndex];

        if (result !== undefined) {
          result.currency = currency;
          changed = true;
        }
      }
    }
  } else {
    warnings.push({ code: "explained", message: `Объяснено пользователем: ${question.id}` });
  }

  if (changed) {
    await writeJsonAtomic(factsPath, facts);
  }

  return { factsChanged: changed, warnings };
}
