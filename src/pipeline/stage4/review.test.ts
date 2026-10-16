import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OpenQuestion } from "../stage3/types";
import { runStage4b } from "./review";
import type { Stage4bParams } from "./types";

let dir = "";

const facts = () => ({
  schema_version: 1,
  meta: {
    candidate_name: "",
    audit_date: "2026-10-09",
    geography: "",
    targets: [{ id: "sales", title: "", share_of_applications: 1 }],
  },
  jobs: [
    {
      id: "job1",
      company: "Ромашка",
      position: "Руководитель",
      start: "2020-01",
      end: "2021-01",
      is_current: false,
      results: [
        {
          id: "res1",
          key: "",
          text: "выручка выросла",
          number: 4200000,
          unit: "",
          currency: null,
          status: "needs_evidence",
          roles: ["sales"],
          evidence_id: "res1",
          hedge_required: false,
        },
      ],
    },
  ],
  education: [],
  languages: [],
  confirmed_skills: [],
  portfolio_projects: [],
});

const question = (overrides: Partial<OpenQuestion> = {}): OpenQuestion => ({
  id: "q_001",
  type: "missing_evidence",
  question: "Чем подтверждается?",
  context: "a.docx",
  relatedClaimIds: ["res1"],
  createdFrom: "audit#gap",
  ...overrides,
});

const setup = async (questions: OpenQuestion[]) => {
  await writeFile(join(dir, "facts.json"), JSON.stringify(facts()), "utf8");
  await writeFile(
    join(dir, "audit.json"),
    JSON.stringify({
      facts_hash: "",
      meta_hash: "",
      generated_at: "2026-10-09T12:00:00Z",
      contradictions: [],
      open_questions: questions,
      warnings: [],
      roles: [],
      ats: {},
    }),
    "utf8",
  );
};

const params = (inputs: string[], output: string[]): Stage4bParams => ({
  workspaceDir: dir,
  auditPath: join(dir, "audit.json"),
  factsPath: join(dir, "facts.json"),
  evidenceDir: join(dir, "evidence"),
  lockPath: join(dir, "facts.lock"),
  answersPath: join(dir, "answers"),
  inputFn: () => Promise.resolve(inputs.shift() ?? ""),
  outputFn: (line: string) => {
    output.push(line);
  },
});

const evidenceInputs = () => [
  "resume.docx",
  "выручка выросла",
  "выручка направления",
  "a - b",
  "2023",
  "база",
  "учёт",
  "отдел",
];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage4-review-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runStage4b()", () => {
  it("пустой audit -> нули", async () => {
    await setup([]);

    const result = await runStage4b(params([], []));

    expect(result.answersProcessed).toBe(0);
    expect(result.locked).toBe(false);
  });

  it("missing_evidence: 9 полей -> evidence записан", async () => {
    await setup([question()]);

    const output: string[] = [];
    const result = await runStage4b(params(evidenceInputs(), output));

    expect(result.answersProcessed).toBe(1);
    expect(result.evidenceWritten).toEqual(["res1"]);
    expect(output.some((line) => line.includes("q_001"))).toBe(true);

    const stored = JSON.parse(await readFile(join(dir, "evidence", "res1.json"), "utf8")) as {
      status: string;
    };

    expect(stored.status).toBe("confirmed");
  });

  it("gap: freeText, evidence не создан", async () => {
    await setup([question({ id: "q_002", type: "gap" })]);

    const result = await runStage4b(params(["был в отпуске"], []));

    expect(result.answersProcessed).toBe(1);
    expect(result.evidenceWritten).toEqual([]);

    const missing = await readFile(join(dir, "evidence", "q_002.json"), "utf8").catch(() => null);

    expect(missing).toBeNull();
  });

  it("смешанный набор -> корректные счётчики", async () => {
    await setup([question(), question({ id: "q_002", type: "gap" }), question({ id: "q_003", type: "gap" })]);

    const result = await runStage4b(params([...evidenceInputs(), "ответ два", "skip"], []));

    expect(result.answersProcessed).toBe(2);
    expect(result.answersDeferred).toBe(1);
    expect(result.answersRejected).toBe(0);
    expect(result.locked).toBe(true);
    expect(result.lockReasons).toEqual([]);
  });

  it("неоднозначный свободный ответ -> deferred, warning, статус в файле", async () => {
    await setup([question({ type: "contradiction" })]);

    const result = await runStage4b(params(["непонятный ответ"], []));

    expect(result.answersProcessed).toBe(0);
    expect(result.answersDeferred).toBe(1);
    expect(result.warnings.some((warning) => warning.code === "answer_unclear")).toBe(true);

    const stored = JSON.parse(await readFile(join(dir, "answers", "q_001.json"), "utf8")) as { status: string };

    expect(stored.status).toBe("deferred");
  });

  it('contradiction + "удалить" -> remove, счётчик answered', async () => {
    await setup([question({ type: "contradiction" })]);

    const result = await runStage4b(params(["удалить"], []));

    expect(result.answersProcessed).toBe(1);
    expect(result.warnings).toEqual([]);

    const stored = JSON.parse(await readFile(join(dir, "facts.json"), "utf8")) as {
      jobs: Array<{ results?: Array<{ status: string }> }>;
    };

    expect(stored.jobs[0]?.results?.[0]?.status).toBe("remove");
  });
});
