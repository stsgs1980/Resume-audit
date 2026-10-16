import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LlmClient } from "../../llm/client";
import type { VerificationResponse } from "../../llm/schemas";
import type { LlmCallResult } from "../../llm/types";
import type { Facts } from "../../schemas/facts";
import { runStage8 } from "./index";
import type { Stage8Params } from "./types";

let dir = "";

/**
 * Факты прогона этапа 8.
 *
 * @returns факты
 */
const makeFacts = (): Facts => {
  return {
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
            text: "выручка",
            number: 4200000,
            unit: "",
            currency: null,
            status: "confirmed",
            roles: ["sales"],
            evidence_id: "res1",
            hedge_required: false,
          },
        ],
      },
    ],
    education: [],
    languages: [],
    confirmed_skills: [{ id: "s1", skill: "SQL", roles: ["sales"] }],
    portfolio_projects: [],
  } as unknown as Facts;
};

/**
 * Документ резюме для версии.
 *
 * @param resultText - текст результата
 * @param skill - навык версии
 * @returns документ
 */
const makeDocument = (resultText: string, skill = "SQL"): Record<string, unknown> => {
  return {
    title: "Руководитель отдела продаж",
    specialization: "sales",
    employment_type: "full",
    work_format: "office",
    experience_total: "10 лет",
    experience_as_of: "2026-10-09",
    about: "Опыт управления командой.",
    jobs: [
      {
        job_id: "job1",
        company: "Ромашка",
        industry: "",
        position: "Руководитель",
        period: "2020-01 - 2021-01",
        duration: "",
        context: "",
        actions: [],
        results: [{ text: resultText, fact_id: "res1", hedge_present: false }],
        total_experience_inconsistent: false,
        total_experience_note: "",
      },
    ],
    skills: [{ skill, skill_id: "s1" }],
    languages: ["Английский"],
  };
};

/**
 * Mock-клиент слоя 2 с пустыми проверками.
 *
 * @returns клиент
 */
const mockClient = (): LlmClient => {
  const payload: VerificationResponse = { checks: [], unsupported_skills: [], forbidden_words_found: [] };

  return {
    health: () => Promise.resolve(true),
    call: <T>(): Promise<LlmCallResult<T>> => Promise.resolve({ ok: true, data: payload as unknown as T }),
  };
};

const setup = async (
  facts: Facts,
  resumes: Record<string, Record<string, unknown>>,
  locked: boolean,
): Promise<void> => {
  await writeFile(join(dir, "facts.json"), JSON.stringify(facts), "utf8");
  await mkdir(join(dir, "resumes"), { recursive: true });

  if (locked) {
    await writeFile(join(dir, "facts.lock"), JSON.stringify({ state: "locked" }), "utf8");
  }

  for (const [versionId, document] of Object.entries(resumes)) {
    await writeFile(
      join(dir, "resumes", `${versionId}.json`),
      JSON.stringify({ versionId, roleId: "sales", document }),
      "utf8",
    );
  }
};

/**
 * Параметры прогона этапа 8.
 *
 * @param llmClient - LLM-клиент
 * @returns параметры
 */
const params = (llmClient: LlmClient): Stage8Params => {
  return {
    factsPath: join(dir, "facts.json"),
    lockPath: join(dir, "facts.lock"),
    resumesDir: join(dir, "resumes"),
    validationDir: join(dir, "validation"),
    evidenceDir: join(dir, "evidence"),
    rolesConfigPath: "config/roles/sales.json",
    llmClient,
    promptConfig: { promptsDir: "config/prompts" },
    modelId: "opencode/space-bunny-free",
    enableLayer2: false,
  };
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage8-run-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runStage8()", () => {
  it("facts не locked -> 0 validated, errors", async () => {
    await setup(makeFacts(), {}, false);

    const result = await runStage8(params(mockClient()));

    expect(result.validated).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("одна версия с ошибками -> blocked true", async () => {
    await setup(makeFacts(), { hh_v1_sales: makeDocument("Сделка на 7,5 млрд RUB") }, true);

    const result = await runStage8(params(mockClient()));

    expect(result.validated).toHaveLength(1);
    expect(result.validated[0]?.blocked).toBe(true);
    expect(result.exportBlocked).toBe(true);
  });

  it("две версии ok -> exportBlocked false", async () => {
    await setup(
      makeFacts(),
      {
        hh_v1_sales: makeDocument("выручка 4,2 млн"),
        hh_v1_salesops: makeDocument("выручка 4,2 млн"),
      },
      true,
    );

    const result = await runStage8(params(mockClient()));

    expect(result.validated).toHaveLength(2);
    expect(result.exportBlocked).toBe(false);
  });

  it("validation/*.json записаны", async () => {
    await setup(makeFacts(), { hh_v1_sales: makeDocument("выручка 4,2 млн") }, true);

    await runStage8(params(mockClient()));

    const stored = JSON.parse(await readFile(join(dir, "validation", "hh_v1_sales.json"), "utf8")) as {
      versionId: string;
      blocked: boolean;
    };

    expect(stored.versionId).toBe("hh_v1_sales");
    expect(typeof stored.blocked).toBe("boolean");
  });

  it("stage-state.json обновлён", async () => {
    await setup(makeFacts(), { hh_v1_sales: makeDocument("выручка 4,2 млн") }, true);

    await runStage8(params(mockClient()));

    const stored = JSON.parse(await readFile(join(dir, "stage-state.json"), "utf8")) as {
      documents: Record<string, { stale: boolean }>;
    };

    expect(typeof stored.documents["hh_v1_sales"]?.stale).toBe("boolean");
  });
});
