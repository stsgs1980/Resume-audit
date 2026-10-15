import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Claim } from "../stage2/types";
import { runStage3a } from "./index";
import type { Stage3aParams } from "./types";

let dir = "";

const claim = (overrides: Partial<Claim> = {}): Claim => ({
  id: "claim1",
  statement: "выручка 4,2 млн руб.",
  quote: "выручка 4,2 млн руб.",
  source_file: "a.docx",
  category: "result",
  metric_type: "выручка",
  number: 4200000,
  currency: "RUB",
  status: "confirmed",
  reason: "",
  ...overrides,
});

const params = (claims: Claim[]): Stage3aParams => ({
  claimsPath: join(dir, "claims.json"),
  auditPath: join(dir, "audit.json"),
  claims,
  auditDate: "2026-10-09",
  roles: ["sales"],
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage3-run-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runStage3a()", () => {
  it("пустой claims -> пустые contradictions, openQuestions", async () => {
    const result = await runStage3a(params([]));

    expect(result.contradictions).toEqual([]);
    expect(result.openQuestions).toEqual([]);
    expect(result.counts).toEqual({ contradictions: 0, openQuestions: 0 });
  });

  it("смешанный набор -> все типы вопросов", async () => {
    const result = await runStage3a(
      params([
        claim({ currency: null }),
        claim({ id: "claim2", status: "needs_evidence" }),
        claim({
          id: "claim3",
          category: "employment",
          number: null,
          currency: null,
          quote: "работал 2020-01 - 2020-06",
        }),
        claim({
          id: "claim4",
          category: "employment",
          number: null,
          currency: null,
          quote: "работал 2020-12 - 2021-06",
        }),
      ]),
    );
    const types = new Set(result.openQuestions.map((question) => question.type));

    expect(types.has("currency_missing")).toBe(true);
    expect(types.has("missing_evidence")).toBe(true);
    expect(types.has("gap")).toBe(true);
  });

  it("audit.json записан, roles и ats пустые", async () => {
    await runStage3a(params([claim()]));

    const stored = JSON.parse(await readFile(join(dir, "audit.json"), "utf8")) as {
      contradictions: unknown[];
      open_questions: unknown[];
      warnings: unknown[];
      roles: unknown[];
      ats: unknown;
    };

    expect(Array.isArray(stored.contradictions)).toBe(true);
    expect(stored.roles).toEqual([]);
    expect(stored.ats).toEqual({});
  });

  it("id присвоены последовательно", async () => {
    const result = await runStage3a(
      params([
        claim({ id: "claim1", number: 100, statement: "выручка 100" }),
        claim({ id: "claim2", number: 130, statement: "выручка 130" }),
        claim({ id: "claim3", currency: null }),
      ]),
    );

    expect(result.contradictions.map((item) => item.id)).toEqual(["contradiction1"]);
    expect(result.openQuestions[0]?.id).toBe("q_001");
  });

  it("загружает claims из файла при пустом входе", async () => {
    await writeFile(join(dir, "claims.json"), JSON.stringify({ claims: [claim({ currency: null })] }), "utf8");

    const result = await runStage3a(params([]));

    expect(result.openQuestions.map((question) => question.type)).toContain("currency_missing");
  });
});
