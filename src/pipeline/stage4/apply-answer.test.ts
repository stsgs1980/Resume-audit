import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OpenQuestion } from "../stage3/types";
import { applyAnswer } from "./apply-answer";
import type { Answer } from "./types";

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

const answer = (overrides: Partial<Answer> = {}): Answer => ({
  questionId: "q_001",
  answeredAt: "",
  answeredBy: "candidate",
  status: "answered",
  ...overrides,
});

const readStatus = async () => {
  const stored = JSON.parse(await readFile(join(dir, "facts.json"), "utf8")) as {
    jobs: Array<{ results?: Array<{ id: string; status: string; currency: string | null }> }>;
  };

  return stored.jobs[0]?.results?.[0];
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage4-apply-"));
  await writeFile(join(dir, "facts.json"), JSON.stringify(facts()), "utf8");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("applyAnswer()", () => {
  it("missing_evidence + answered -> confirmed", async () => {
    const result = await applyAnswer(question(), answer(), join(dir, "facts.json"));

    expect(result.factsChanged).toBe(true);
    expect((await readStatus())?.status).toBe("confirmed");
  });

  it("deferred -> ничего не меняется", async () => {
    const result = await applyAnswer(question(), answer({ status: "deferred" }), join(dir, "facts.json"));

    expect(result.factsChanged).toBe(false);
    expect((await readStatus())?.status).toBe("needs_evidence");
  });

  it('currency_missing + "USD" -> currency USD', async () => {
    await applyAnswer(
      question({ type: "currency_missing" }),
      answer({ freeText: "валюта USD, точно" }),
      join(dir, "facts.json"),
    );

    expect((await readStatus())?.currency).toBe("USD");
  });

  it('target_vs_measured + "target" -> remove', async () => {
    await applyAnswer(
      question({ type: "target_vs_measured" }),
      answer({ freeText: "это target" }),
      join(dir, "facts.json"),
    );

    expect((await readStatus())?.status).toBe("remove");
  });

  it("gap объясняет -> warning без изменений", async () => {
    const result = await applyAnswer(
      question({ type: "gap" }),
      answer({ freeText: "был в отпуске" }),
      join(dir, "facts.json"),
    );

    expect(result.factsChanged).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
