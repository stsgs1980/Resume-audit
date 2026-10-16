import { describe, expect, it } from "vitest";
import type { LlmClient } from "../../llm/client";
import type { ResumeResponse, VerificationResponse } from "../../llm/schemas";
import type { LlmCallResult } from "../../llm/types";
import type { Facts } from "../../schemas/facts";
import { verifyLayer2 } from "./layer2";

const resume = { title: "Руководитель", jobs: [] } as unknown as ResumeResponse;
const facts = { jobs: [] } as unknown as Facts;

/**
 * Mock-клиент с заданным ответом.
 *
 * @param response - ответ вызова
 * @returns клиент
 */
const clientWith = (response: LlmCallResult<VerificationResponse>): LlmClient => {
  return {
    health: () => Promise.resolve(true),
    call: <T>(): Promise<LlmCallResult<T>> => Promise.resolve(response as unknown as LlmCallResult<T>),
  };
};

const okPayload: VerificationResponse = {
  checks: [
    {
      number: "4,2 млн",
      claim: "рост выручки",
      matches_fact: false,
      fact_id: null,
      matches_role: true,
      has_hedge: false,
      verdict: "unsupported_number",
      comment: "нет факта",
    },
  ],
  unsupported_skills: ["Go"],
  forbidden_words_found: [],
};

describe("verifyLayer2()", () => {
  it("mock LLM возвращает ok -> layer2 заполнен", async () => {
    const { layer2, error } = await verifyLayer2(
      resume,
      facts,
      "sales",
      clientWith({
        ok: true,
        data: okPayload,
      }),
      { promptsDir: "config/prompts" },
    );

    expect(error).toBeNull();
    expect(layer2?.checks).toHaveLength(1);
    expect(layer2?.checks[0]).toMatchObject({ number: "4,2 млн", matchesFact: false });
    expect(layer2?.unsupportedSkills).toEqual(["Go"]);
  });

  it("mock LLM с ошибкой -> layer2 null, error", async () => {
    const { layer2, error } = await verifyLayer2(
      resume,
      facts,
      "sales",
      clientWith({
        ok: false,
        error: { kind: "unavailable", message: "down" },
      }),
      { promptsDir: "config/prompts" },
    );

    expect(layer2).toBeNull();
    expect(error).toContain("down");
  });

  it("verdict unsupported_number -> в checks", async () => {
    const { layer2 } = await verifyLayer2(
      resume,
      facts,
      "sales",
      clientWith({
        ok: true,
        data: okPayload,
      }),
      { promptsDir: "config/prompts" },
    );

    expect(layer2?.checks[0]?.verdict).toBe("unsupported_number");
  });
});
