import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OpenQuestion } from "../stage3/types";
import { filterUnanswered, loadQuestions, saveAnswer } from "./question-queue";

let dir = "";

const question = (overrides: Partial<OpenQuestion> = {}): OpenQuestion => ({
  id: "q_001",
  type: "missing_evidence",
  question: "Чем подтверждается?",
  context: "a.docx",
  relatedClaimIds: ["res1"],
  createdFrom: "audit#gap",
  ...overrides,
});

const writeAudit = (questions: OpenQuestion[]) =>
  writeFile(join(dir, "audit.json"), JSON.stringify({ open_questions: questions }), "utf8");

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage4-queue-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("loadQuestions()", () => {
  it("читает open_questions", async () => {
    await writeAudit([question(), question({ id: "q_002" })]);

    expect(await loadQuestions(join(dir, "audit.json"))).toHaveLength(2);
  });

  it("нет файла -> []", async () => {
    expect(await loadQuestions(join(dir, "missing.json"))).toEqual([]);
  });
});

describe("saveAnswer() + filterUnanswered()", () => {
  it("saveAnswer пишет в правильный файл", async () => {
    const answersDir = join(dir, "answers");

    await saveAnswer({ questionId: "q_001", answeredAt: "", answeredBy: "candidate", status: "answered" }, answersDir);

    const stored = JSON.parse(await readFile(join(answersDir, "q_001.json"), "utf8")) as {
      questionId: string;
    };

    expect(stored.questionId).toBe("q_001");
  });

  it("filterUnanswered убирает отвеченные", async () => {
    const answersDir = join(dir, "answers");

    await writeAudit([question(), question({ id: "q_002" })]);
    await saveAnswer({ questionId: "q_001", answeredAt: "", answeredBy: "candidate", status: "deferred" }, answersDir);

    const rest = await filterUnanswered(await loadQuestions(join(dir, "audit.json")), answersDir);

    expect(rest.map((entry) => entry.id)).toEqual(["q_002"]);
  });
});
