import { factsSchema } from "../../schemas/facts";
import { readJson } from "../../server/storage/files";
import type { OpenQuestion } from "../stage3/types";
import { applyAnswer } from "./apply-answer";
import { writeEvidence } from "./evidence-writer";
import { saveAnswer } from "./question-queue";
import type { Answer, EvidenceData, JobResult, Stage4bParams } from "./types";

/** Вопросы для 8 полей карточки evidence. */
const EVIDENCE_PROMPTS: Array<{ label: string; field: keyof EvidenceData }> = [
  { label: "Источник (файл):", field: "sourceFile" },
  { label: "Цитата:", field: "quote" },
  { label: "Определение метрики:", field: "metricDefinition" },
  { label: "Формула:", field: "formula" },
  { label: "Период:", field: "period" },
  { label: "База:", field: "baseline" },
  { label: "Источник данных:", field: "sourceOfData" },
  { label: "Зона влияния:", field: "zoneOfInfluence" },
];

/**
 * Собирает карточку evidence через 8 вопросов.
 *
 * @param inputFn - функция ввода
 * @returns данные карточки и признак пустоты
 */
async function collectEvidence(
  inputFn: (prompt: string) => Promise<string>,
): Promise<{ data: EvidenceData; empty: boolean }> {
  const data = {} as EvidenceData;
  let empty = true;

  for (const { label, field } of EVIDENCE_PROMPTS) {
    const value = (await inputFn(`${label} `)).trim();

    data[field] = value;

    if (value !== "") {
      empty = false;
    }
  }

  return { data, empty };
}

/**
 * Загружает результаты из facts.json для связи claim -> result.
 * При ошибке чтения возвращает пустой список (связь даст fallback).
 *
 * @param factsPath - путь к facts.json
 * @returns результаты всех работ
 */
async function loadResults(factsPath: string): Promise<JobResult[]> {
  try {
    const facts = await readJson(factsPath, factsSchema);

    return facts.jobs.flatMap((job) => job.results ?? []);
  } catch {
    return [];
  }
}

/**
 * Обрабатывает один вопрос: вывод, ввод, сохранение, evidence, применение.
 * Неоднозначный свободный ответ факты не меняет: ответ помечается
 * deferred, warning answer_unclear уходит в итоги этапа.
 *
 * @param question - вопрос
 * @param params - параметры этапа
 * @param inputFn - функция ввода
 * @param outputFn - функция вывода
 * @returns статус ответа, fact_id карточки и предупреждения
 */
export async function processQuestion(
  question: OpenQuestion,
  params: Stage4bParams,
  inputFn: (prompt: string) => Promise<string>,
  outputFn: (line: string) => void,
): Promise<{ status: Answer["status"]; factId: string | null; warnings: Array<{ code: string; message: string }> }> {
  outputFn(`=== Вопрос ${question.id} (${question.type}) ===`);
  outputFn(question.question);
  outputFn(`Контекст: ${question.context}`);

  let answer: Answer;

  if (question.type === "missing_evidence") {
    const { data, empty } = await collectEvidence(inputFn);

    answer = {
      questionId: question.id,
      answeredAt: new Date().toISOString(),
      answeredBy: "candidate",
      status: empty ? "deferred" : "answered",
      evidence: empty ? undefined : data,
    };
  } else {
    const freeText = (await inputFn("Ответ (или 'skip'/'reject'): ")).trim();
    const lowered = freeText.toLowerCase();

    answer = {
      questionId: question.id,
      answeredAt: new Date().toISOString(),
      answeredBy: "candidate",
      status: lowered === "skip" || freeText === "" ? "deferred" : lowered === "reject" ? "rejected" : "answered",
      freeText,
    };
  }

  await saveAnswer(answer, params.answersPath);

  let factId: string | null = null;
  const warnings: Array<{ code: string; message: string }> = [];

  if (answer.status === "answered" && answer.evidence !== undefined) {
    const written = await writeEvidence(
      question,
      answer.evidence,
      await loadResults(params.factsPath),
      params.evidenceDir,
    );

    factId = written.factId;
    warnings.push(...written.warnings);
  }

  if (answer.status === "answered") {
    const applied = await applyAnswer(question, answer, params.factsPath);

    warnings.push(...applied.warnings);

    if (applied.warnings.some((warning) => warning.code === "answer_unclear")) {
      await saveAnswer({ ...answer, status: "deferred" }, params.answersPath);

      return { status: "deferred", factId, warnings };
    }
  }

  return { status: answer.status, factId, warnings };
}
