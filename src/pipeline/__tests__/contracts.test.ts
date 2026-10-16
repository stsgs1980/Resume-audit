import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LlmClient } from "../../llm/client";
import type { LlmCallResult } from "../../llm/types";
import { runStage3a } from "../stage3/index";
import { runStage4a } from "../stage4/index";
import { runStage7 } from "../stage7/index";

let dir = "";

const resumeDocument = {
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

const okClient: LlmClient = {
  health: () => Promise.resolve(true),
  call: <T>(): Promise<LlmCallResult<T>> => Promise.resolve({ ok: true, data: resumeDocument as unknown as T }),
};

const factsV2 = {
  schema_version: 2,
  meta: {
    candidate_name: "",
    audit_date: "2026-10-09",
    geography: "",
    targets: [{ id: "sales", title: "", share_of_applications: 1 }],
  },
  jobs: [],
  education: [],
  languages: [],
  confirmed_skills: [],
  portfolio_projects: [],
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "contracts-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("C2: невалидные JSON не роняют конвейер", () => {
  it("битый claims.json: stage4a -> warning, не падает", async () => {
    await writeFile(join(dir, "claims.json"), "{ not json", "utf8");

    const result = await runStage4a({
      claimsPath: join(dir, "claims.json"),
      factsPath: join(dir, "facts.json"),
      auditPath: join(dir, "audit.json"),
      rolesConfigPath: "config/roles/sales.json",
      auditDate: "2026-10-09",
    });

    expect(result.written).toBe(false);
    expect(result.warnings.some((warning) => warning.code === "claims_unreadable")).toBe(true);
  });

  it("битый claims.json: stage3a -> warning, не падает", async () => {
    await writeFile(join(dir, "claims.json"), "{ not json", "utf8");

    const result = await runStage3a({
      claimsPath: join(dir, "claims.json"),
      auditPath: join(dir, "audit.json"),
      claims: [],
      auditDate: "2026-10-09",
      roles: ["sales"],
    });

    expect(result.warnings.some((warning) => warning.kind === "claims_unreadable")).toBe(true);
  });

  it("невалидный по схеме facts.json: stage7 -> errors, без генерации", async () => {
    await writeFile(join(dir, "facts.json"), JSON.stringify(factsV2), "utf8");
    await writeFile(join(dir, "facts.lock"), JSON.stringify({ state: "locked" }), "utf8");

    const result = await runStage7({
      factsPath: join(dir, "facts.json"),
      lockPath: join(dir, "facts.lock"),
      rolesConfigDir: "config/roles",
      resumesDir: join(dir, "resumes"),
      defensePath: join(dir, "interview-defense.md"),
      llmClient: okClient,
      promptConfig: { promptsDir: "config/prompts" },
      modelId: "test/model",
    });

    expect(result.generated).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
