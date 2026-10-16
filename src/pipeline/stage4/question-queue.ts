import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { writeJsonAtomic } from "../../server/storage/files";
import type { OpenQuestion } from "../stage3/types";
import type { Answer } from "./types";

/**
 * Читает открытые вопросы из audit.json. Файла нет — [].
 *
 * @param auditPath - путь к audit.json
 * @returns вопросы
 */
export async function loadQuestions(auditPath: string): Promise<OpenQuestion[]> {
  try {
    const parsed = JSON.parse(await readFile(auditPath, "utf8")) as { open_questions?: unknown };

    return Array.isArray(parsed.open_questions) ? (parsed.open_questions as OpenQuestion[]) : [];
  } catch {
    return [];
  }
}

/**
 * Читает id отвеченных вопросов из директории ответов.
 *
 * @param answersPath - директория ответов
 * @returns множество id с ответами
 */
async function readAnsweredIds(answersPath: string): Promise<Set<string>> {
  try {
    const names = await readdir(answersPath);
    const ids = new Set<string>();

    for (const name of names) {
      if (name.endsWith(".json")) {
        try {
          const parsed = JSON.parse(await readFile(join(answersPath, name), "utf8")) as {
            questionId?: unknown;
          };

          if (typeof parsed.questionId === "string") {
            ids.add(parsed.questionId);
          }
        } catch {
          // Битый ответ — как будто его нет.
        }
      }
    }

    return ids;
  } catch {
    return new Set();
  }
}

/**
 * Оставляет только вопросы без ответов.
 *
 * @param questions - все вопросы
 * @param answersPath - директория ответов
 * @returns неотвеченные вопросы
 */
export async function filterUnanswered(questions: OpenQuestion[], answersPath: string): Promise<OpenQuestion[]> {
  const answered = await readAnsweredIds(answersPath);

  return questions.filter((question) => !answered.has(question.id));
}

/**
 * Сохраняет ответ атомарно в answersPath/<questionId>.json.
 *
 * @param answer - ответ кандидата
 * @param answersPath - директория ответов
 */
export async function saveAnswer(answer: Answer, answersPath: string): Promise<void> {
  await writeJsonAtomic(join(answersPath, `${answer.questionId}.json`), answer);
}
