import { join } from "node:path";
import { createInterface } from "node:readline";
import { stageStateSchema } from "../../schemas/stage-state";
import { readJson, writeJsonAtomic } from "../../server/storage/files";
import { tryLock } from "./lock";
import { processQuestion } from "./process-question";
import { filterUnanswered, loadQuestions } from "./question-queue";
import type { Stage4bParams, Stage4bResult } from "./types";

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
