import { describe, expect, it } from "vitest";
import type { LlmClient } from "../../llm/client";
import type { LlmCallResult } from "../../llm/types";
import type { Facts } from "../../schemas/facts";
import { generateForRole } from "./generate-one";
import type { Stage7Params } from "./types";

const facts = {
  schema_version: 1,
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
} as unknown as Facts;

const document = {
  title: "Руководитель",
  specialization: "sales",
  employment_type: "full",
  work_format: "office",
  experience_total: "10 лет",
  experience_as_of: "2026-10-09",
  about: "Опыт.",
  jobs: [],
  skills: [],
  languages: [],
};

const params = (llmClient: LlmClient): Stage7Params => ({
  factsPath: "facts.json",
  lockPath: "facts.lock",
  rolesConfigDir: "config/roles",
  resumesDir: "resumes",
  defensePath: "interview-defense.md",
  llmClient,
  promptConfig: { promptsDir: "config/prompts" },
  modelId: "opencode/space-bunny-free",
});

const okClient = (seen: string[]): LlmClient => ({
  health: () => Promise.resolve(true),
  call: <T>(callParams: { stage?: string }): Promise<LlmCallResult<T>> => {
    seen.push(callParams.stage ?? "");

    return Promise.resolve({ ok: true, data: document as unknown as T });
  },
});

describe("generateForRole()", () => {
  it("вызывает call с правильным stage", async () => {
    const seen: string[] = [];

    await generateForRole(facts, "sales", params(okClient(seen)));

    expect(seen).toEqual(["generation_sales"]);
  });

  it("маппит промты всех ролей", async () => {
    const seen: string[] = [];
    const client = okClient(seen);

    await generateForRole(facts, "salesops", params(client));
    await generateForRole(facts, "aipo", params(client));

    expect(seen).toEqual(["generation_salesops", "generation_aipo"]);
  });

  it("успех -> GeneratedResume с полями", async () => {
    const { resume, error } = await generateForRole(facts, "sales", params(okClient([])));

    expect(error).toBeNull();
    expect(resume).toMatchObject({
      versionId: "hh_v1_sales",
      roleId: "sales",
      promptVersion: "generation.sales.v1",
      modelId: "opencode/space-bunny-free",
    });
    expect(resume?.factsHash.startsWith("sha256:")).toBe(true);
    expect(resume?.document.title).toBe("Руководитель");
  });

  it("ошибка LLM -> error, resume null", async () => {
    const client: LlmClient = {
      health: () => Promise.resolve(true),
      call: <T>(): Promise<LlmCallResult<T>> =>
        Promise.resolve({ ok: false, error: { kind: "unavailable", message: "down" } }),
    };

    const { resume, error } = await generateForRole(facts, "sales", params(client));

    expect(resume).toBeNull();
    expect(error).toContain("down");
  });
});
