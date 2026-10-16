import { join } from "node:path";
import { createInterface } from "node:readline";
import { factsSchema } from "../../schemas/facts";
import { stageStateSchema } from "../../schemas/stage-state";
import { readJson, writeJsonAtomic } from "../../server/storage/files";
import type { OpenQuestion } from "../stage3/types";
import { applyAnswer } from "./apply-answer";
import { writeEvidence } from "./evidence-writer";
import { tryLock } from "./lock";
import { filterUnanswered, loadQuestions, saveAnswer } from "./question-queue";
import type { Answer, EvidenceData, JobResult, Stage4bParams, Stage4bResult } from "./types";

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
 * Ввод по умолчанию через readline (создаётся и закрывается на каждый вызов).
 *
 * @param prompt - приглашение
 * @returns введённая строка
 */
const defaultInput = (prompt: string): Promise<string> =>
  new Promise((resolve) => {
    const terminal = createInterface({ input: process.stdin, output: process.stdout });

    terminal.question(prompt, (answer) => {
      terminal.close();
      resolve(answer);
    });
  });

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
 *
 * @param question - вопрос
 * @param params - параметры этапа
 * @param inputFn - функция ввода
 * @param outputFn - функция вывода
 * @returns статус ответа, fact_id карточки и предупреждения
 */
async function processQuestion(
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
    await applyAnswer(question, answer, params.factsPath);
  }

  return { status: answer.status, factId, warnings };
}

/**
 * Обновляет запись этапа 4 в stage-state.json.
 *
 * @param workspaceDir - директория workspace
 * @param locked - итог блокировки
 */
async function updateStageState(workspaceDir: string, locked: boolean): Promise<void> {
  const stageStatePath = join(workspaceDir, "stage-state.json");
  let state;

  try {
    state = await readJson(stageStatePath, stageStateSchema);
  } catch (error) {
    if ((error as Error).name !== "FileNotFoundError") {
      throw error;
    }

    state = { run_id: "", stages: {}, documents: {} };
  }

  await writeJsonAtomic(stageStatePath, {
    ...state,
    stages: {
      ...state.stages,
      4: { status: locked ? "completed" : "incomplete", updated_at: new Date().toISOString() },
    },
  });
}

/**
 * Запускает этап 4b: вопросы, evidence, применение, lock.
 * Ошибки не бросает: всё фиксируется в warnings.
 *
 * @param params - пути workspace и функции ввода/вывода
 * @returns итог этапа
 */
export async function runStage4b(params: Stage4bParams): Promise<Stage4bResult> {
  const inputFn = params.inputFn ?? defaultInput;
  const outputFn = params.outputFn ?? console.log;
  const warnings: Array<{ code: string; message: string }> = [];
  const result: Stage4bResult = {
    answersProcessed: 0,
    answersDeferred: 0,
    answersRejected: 0,
    evidenceWritten: [],
    locked: false,
    lockReasons: [],
    warnings,
  };

  try {
    const questions = await filterUnanswered(await loadQuestions(params.auditPath), params.answersPath);

    for (const question of questions) {
      try {
        const {
          status,
          factId,
          warnings: questionWarnings,
        } = await processQuestion(question, params, inputFn, outputFn);

        warnings.push(...questionWarnings);

        if (status === "answered") {
          result.answersProcessed += 1;
        } else if (status === "deferred") {
          result.answersDeferred += 1;
        } else {
          result.answersRejected += 1;
        }

        if (factId !== null) {
          result.evidenceWritten.push(factId);
        }
      } catch (error) {
        warnings.push({ code: "question_failed", message: `${question.id}: ${(error as Error).message}` });
      }
    }

    const locked = await tryLock(params.factsPath, params.lockPath, params.evidenceDir, params.answersPath);

    result.locked = locked.locked;
    result.lockReasons = locked.reasons;

    try {
      await updateStageState(params.workspaceDir, locked.locked);
    } catch (error) {
      warnings.push({ code: "stage_state_failed", message: (error as Error).message });
    }

    return result;
  } catch (error) {
    warnings.push({ code: "stage4_error", message: (error as Error).message });

    return result;
  }
}
