import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LlmClient } from "../../llm/client";
import type { LlmCallResult } from "../../llm/types";
import type { Claim } from "../stage2/types";
import { runStage3b } from "./stage3b";

let promptsDir = "";

const claims: Claim[] = [
  {
    id: "claim1",
    statement: "управление командой",
    quote: "управлял командой",
    source_file: "a.docx",
    category: "skill",
    metric_type: "",
    number: null,
    currency: null,
    status: "confirmed",
    reason: "",
  },
];

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

const okClient = (): LlmClient => ({
  health: () => Promise.resolve(true),
  call: <T>(): Promise<LlmCallResult<T>> => Promise.resolve({ ok: true, data: rolesData as unknown as T }),
});

const params = (llmClient: LlmClient) => ({
  claims,
  rolesConfigPath: "config/roles/sales.json",
  llmClient,
  promptConfig: { promptsDir },
  vacancyText: null,
  targetRoleId: "sales",
});

beforeEach(async () => {
  promptsDir = await mkdtemp(join(tmpdir(), "stage3b-"));
  await writeFile(join(promptsDir, "roles.v1.md"), "# roles", "utf8");
});

afterEach(async () => {
  await rm(promptsDir, { recursive: true, force: true });
});

describe("runStage3b()", () => {
  it("объединяет roles и ats", async () => {
    const result = await runStage3b(params(okClient()));

    expect(result.roles).toHaveLength(1);
    expect(result.roles[0]?.roleId).toBe("sales");
    expect(result.ats?.roleId).toBe("sales");
    expect(result.errors).toEqual([]);
  });

  it("ошибка в roles не ломает ats", async () => {
    const client: LlmClient = {
      health: () => Promise.resolve(true),
      call: <T>(): Promise<LlmCallResult<T>> =>
        Promise.resolve({ ok: false, error: { kind: "unavailable", message: "down" } }),
    };

    const result = await runStage3b(params(client));

    expect(result.roles).toEqual([]);
    expect(result.ats?.roleId).toBe("sales");
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
