import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LlmClient } from "../../llm/client";
import type { LlmCallResult } from "../../llm/types";
import type { Facts } from "../../schemas/facts";
import { runStage7 } from "./index";
import type { Stage7Params } from "./types";

let dir = "";

const facts = {
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
          number: 1,
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
  confirmed_skills: [],
  portfolio_projects: [],
} as unknown as Facts;

const document = {
  title: "Руководитель",
  specialization: "sales",
  employment_type: "full",
  work_format: "office",
  experience_total: "10 лет",
  experience_as_of: "2026-10-09",
  about: "Опыт.",
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
      results: [{ text: "выручка выросла", fact_id: "res1", hedge_present: false }],
      total_experience_inconsistent: false,
      total_experience_note: "",
    },
  ],
  skills: [],
  languages: [],
};

const clientFor = (failStages: string[]): LlmClient => ({
  health: () => Promise.resolve(true),
  call: <T>(callParams: { stage?: string }): Promise<LlmCallResult<T>> =>
    failStages.includes(callParams.stage ?? "")
      ? Promise.resolve({ ok: false, error: { kind: "unavailable", message: "down" } })
      : Promise.resolve({ ok: true, data: document as unknown as T }),
});

const params = (llmClient: LlmClient): Stage7Params => ({
  factsPath: join(dir, "facts.json"),
  lockPath: join(dir, "facts.lock"),
  rolesConfigDir: "config/roles",
  resumesDir: join(dir, "resumes"),
  defensePath: join(dir, "interview-defense.md"),
  llmClient,
  promptConfig: { promptsDir: "config/prompts" },
  modelId: "opencode/space-bunny-free",
});

const setup = async (locked: boolean) => {
  await writeFile(join(dir, "facts.json"), JSON.stringify(facts), "utf8");

  if (locked) {
    await writeFile(join(dir, "facts.lock"), JSON.stringify({ state: "locked" }), "utf8");
  }
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage7-run-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runStage7()", () => {
  it("facts не locked -> 0 generated, errors не пуст", async () => {
    await setup(false);

    const result = await runStage7(params(clientFor([])));

    expect(result.generated).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.defensePath).toBeNull();
  });

  it("все три роли успешны -> 3 generated", async () => {
    await setup(true);

    const result = await runStage7(params(clientFor([])));

    expect(result.generated).toHaveLength(3);
    expect(result.errors).toEqual([]);

    for (const role of ["sales", "salesops", "aipo"]) {
      const stored = JSON.parse(await readFile(join(dir, "resumes", `hh_v1_${role}.json`), "utf8")) as {
        versionId: string;
      };

      expect(stored.versionId).toBe(`hh_v1_${role}`);
    }
  });

  it("одна роль упала -> 2 generated, 1 в errors", async () => {
    await setup(true);

    const result = await runStage7(params(clientFor(["generation_salesops"])));

    expect(result.generated).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.roleId).toBe("salesops");
  });

  it("interview-defense.md записан", async () => {
    await setup(true);

    const result = await runStage7(params(clientFor([])));

    expect(result.defensePath).toBe(join(dir, "interview-defense.md"));

    const text = await readFile(join(dir, "interview-defense.md"), "utf8");

    expect(text).toContain("## res1");
  });

  it("stage-state.json обновлён", async () => {
    await setup(true);

    await runStage7(params(clientFor([])));

    const stored = JSON.parse(await readFile(join(dir, "stage-state.json"), "utf8")) as {
      documents: Record<string, { facts_hash: string }>;
    };

    expect(stored.documents["hh_v1_sales"]?.facts_hash.startsWith("sha256:")).toBe(true);
  });
});
