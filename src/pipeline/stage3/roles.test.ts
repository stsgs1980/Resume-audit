import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LlmClient } from "../../llm/client";
import type { RolesResponse } from "../../llm/schemas";
import type { LlmCallResult } from "../../llm/types";
import type { Claim } from "../stage2/types";
import { assessRoles, transformRoleResponse } from "./roles";

let promptsDir = "";

const response: RolesResponse = {
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
      gaps: ["ats"],
      overpositioning_risk: 2,
      recommendation: "подходит",
    },
  ],
};

const claims: Claim[] = [
  {
    id: "claim1",
    statement: "выручка 4,2 млн",
    quote: "выручка 4,2 млн руб.",
    source_file: "a.docx",
    category: "result",
    metric_type: "выручка",
    number: 4200000,
    currency: "RUB",
    status: "confirmed",
    reason: "",
  },
];

const okClient = (): LlmClient => ({
  health: () => Promise.resolve(true),
  call: <T>(): Promise<LlmCallResult<T>> =>
    Promise.resolve({ ok: true, data: { roles: response.roles } as unknown as T }),
});

beforeEach(async () => {
  promptsDir = await mkdtemp(join(tmpdir(), "stage3-roles-"));
  await writeFile(join(promptsDir, "roles.v1.md"), "# roles", "utf8");
});

afterEach(async () => {
  await rm(promptsDir, { recursive: true, force: true });
});

describe("assessRoles()", () => {
  it("возвращает оценки", async () => {
    const result = await assessRoles(claims, okClient(), { promptsDir }, "sales");

    expect(result.error).toBeNull();
    expect(result.assessments).toHaveLength(1);
    expect(result.assessments[0]?.roleId).toBe("sales");
    expect(result.assessments[0]?.overpositioningRisk).toBe(2);
  });

  it("ошибка LLM -> error, assessments пустой", async () => {
    const client: LlmClient = {
      health: () => Promise.resolve(true),
      call: <T>(): Promise<LlmCallResult<T>> =>
        Promise.resolve({ ok: false, error: { kind: "unavailable", message: "down" } }),
    };

    const result = await assessRoles(claims, client, { promptsDir }, "sales");

    expect(result.assessments).toEqual([]);
    expect(result.error).toContain("down");
  });
});

describe("transformRoleResponse()", () => {
  it("маппит snake_case в camelCase", () => {
    const [first] = transformRoleResponse(response);

    expect(first).toMatchObject({
      roleId: "sales",
      total: 45,
      strengths: ["опыт"],
      overpositioningRisk: 2,
    });
    expect(first?.scores).toMatchObject({ hiring_manager: 8, experience_fit: 8 });
  });
});
