import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LlmClient } from "../../llm/client";
import type { LlmCallResult } from "../../llm/types";
import type { Claim } from "../stage2/types";
import { runStage3, runStage3a } from "./index";
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

  it("experience: стыкующиеся работы -> naive 184, distinct 183, difference 1", async () => {
    await runStage3a(
      params([
        claim({
          id: "claim1",
          category: "employment",
          number: null,
          currency: null,
          quote: "работал 2010-01 - 2019-04",
        }),
        claim({
          id: "claim2",
          category: "employment",
          number: null,
          currency: null,
          quote: "работал 2019-04 - 2025-03",
        }),
      ]),
    );

    const stored = JSON.parse(await readFile(join(dir, "audit.json"), "utf8")) as {
      experience: {
        naive: number;
        distinct: number;
        difference: number;
        formattedNaive: string;
        formattedDistinct: string;
      };
    };

    expect(stored.experience.naive).toBe(184);
    expect(stored.experience.distinct).toBe(183);
    expect(stored.experience.difference).toBe(1);
    expect(stored.experience.formattedNaive).toBe("15 лет 4 месяца");
    expect(stored.experience.formattedDistinct).toBe("15 лет 3 месяца");
  });

  it("загружает claims из файла при пустом входе", async () => {
    await writeFile(join(dir, "claims.json"), JSON.stringify({ claims: [claim({ currency: null })] }), "utf8");

    const result = await runStage3a(params([]));

    expect(result.openQuestions.map((question) => question.type)).toContain("currency_missing");
  });
});

describe("runStage3()", () => {
  it("пишет полный audit.json с roles и ats", async () => {
    const promptsDir = join(dir, "prompts");

    await mkdir(promptsDir, { recursive: true });
    await writeFile(join(promptsDir, "roles.v1.md"), "# roles", "utf8");

    const rolesData = {
      roles: [
        {
          role_id: "sales",
          scores: {
            experience_fit: 8,
            responsibility_level: 7,
            measurable_results: 9,
            keyword_fit: 6,
            hr_screen: 7,
            hiring_manager: 8,
          },
          total: 45,
          strengths: ["опыт"],
          gaps: [],
          overpositioning_risk: 2,
          recommendation: "подходит",
        },
      ],
    };
    const llmClient: LlmClient = {
      health: () => Promise.resolve(true),
      call: <T>(): Promise<LlmCallResult<T>> => Promise.resolve({ ok: true, data: rolesData as unknown as T }),
    };

    const result = await runStage3({
      claims: [claim()],
      claimsPath: join(dir, "claims.json"),
      auditPath: join(dir, "audit.json"),
      auditDate: "2026-10-09",
      roles: ["sales"],
      rolesConfigPath: "config/roles/sales.json",
      llmClient,
      promptConfig: { promptsDir },
      vacancyText: null,
      targetRoleId: "sales",
    });

    expect(result.roles).toHaveLength(1);
    expect(result.ats?.roleId).toBe("sales");

    const stored = JSON.parse(await readFile(join(dir, "audit.json"), "utf8")) as {
      contradictions: unknown[];
      open_questions: unknown[];
      roles: unknown[];
      ats: unknown;
    };

    expect(Array.isArray(stored.contradictions)).toBe(true);
    expect(stored.roles).toHaveLength(1);
    expect(stored.ats).toMatchObject({ roleId: "sales" });
  });
});
