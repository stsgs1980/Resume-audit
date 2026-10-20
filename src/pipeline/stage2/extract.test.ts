import { describe, expect, it } from "vitest";
import type { LlmClient } from "../../llm/client";
import { extractionResponseSchema } from "../../llm/schemas";
import type { LlmCallResult } from "../../llm/types";
import type { FileEntry } from "../stage1/types";
import { extractClaimsFromFile, softenExtractionResponse } from "./extract";

const file: FileEntry = {
  path: "resume.docx",
  name: "resume.docx",
  kind: "resume_draft",
  status: "ok",
  encoding: null,
  warnings: [],
  size: 100,
};

const promptConfig = { promptsDir: "config/prompts" };

/**
 * Валидный claim для тестов смягчения.
 *
 * @param overrides - переопределённые поля
 * @returns claim
 */
const validClaim = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  statement: "рост",
  quote: "выручка выросла",
  source_file: "resume.docx",
  category: "result",
  metric_type: "выручка",
  number: 1,
  currency: null,
  status: "confirmed",
  reason: "",
  ...overrides,
});

const okClient = (claims: unknown[]): LlmClient => ({
  health: () => Promise.resolve(true),
  call: <T>(): Promise<LlmCallResult<T>> => Promise.resolve({ ok: true, data: { claims } as unknown as T }),
});

describe("extractClaimsFromFile()", () => {
  it("вызывает call с system, user, schema и stage", async () => {
    const seen: unknown[] = [];
    const client: LlmClient = {
      health: () => Promise.resolve(true),
      call: <T>(params: { user: string }): Promise<LlmCallResult<T>> => {
        seen.push(params);

        return Promise.resolve({ ok: true, data: { claims: [] } as unknown as T });
      },
    };

    await extractClaimsFromFile(file, "текст резюме", client, promptConfig);

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ stage: "extraction" });
  });

  it("ошибка LLM -> { claims: [], error }", async () => {
    const client: LlmClient = {
      health: () => Promise.resolve(true),
      call: () => Promise.resolve({ ok: false, error: { kind: "unavailable", message: "down" } }),
    };

    const result = await extractClaimsFromFile(file, "текст", client, promptConfig);

    expect(result).toEqual({ claims: [], error: "down", warnings: [] });
  });

  it("успех -> claims из data", async () => {
    const claims = [
      {
        statement: "рост",
        quote: "выручка выросла",
        source_file: "resume.docx",
        category: "result",
        metric_type: "выручка",
        number: 1,
        currency: null,
        status: "confirmed",
        reason: "",
      },
    ];

    const result = await extractClaimsFromFile(file, "текст", okClient(claims), promptConfig);

    expect(result).toEqual({ claims, error: null, warnings: [] });
  });

  it("user содержит текст файла", async () => {
    let user = "";
    const client: LlmClient = {
      health: () => Promise.resolve(true),
      call: <T>(params: { user: string }): Promise<LlmCallResult<T>> => {
        user = params.user;

        return Promise.resolve({ ok: true, data: { claims: [] } as unknown as T });
      },
    };

    await extractClaimsFromFile(file, "УНИКАЛЬНЫЙ ТЕКСТ", client, promptConfig);

    expect(user).toContain("УНИКАЛЬНЫЙ ТЕКСТ");
    expect(user).toContain("---");
  });

  it("считает вызовы через счётчик", async () => {
    let calls = 0;
    const call = async <T>(): Promise<LlmCallResult<T>> => {
      calls += 1;

      return { ok: true, data: { claims: [] } as unknown as T };
    };
    const client: LlmClient = { health: () => Promise.resolve(true), call };

    await extractClaimsFromFile(file, "текст", client, promptConfig);

    expect(calls).toBe(1);
  });

  it("смягчает невалидный ответ и возвращает warnings", async () => {
    const raw = { claims: [validClaim({ category: "achievement_metric", status: "supported" })] };

    const result = await extractClaimsFromFile(file, "текст", okClient(raw.claims), promptConfig);

    expect(result.claims[0]?.category).toBe("result");
    expect(result.claims[0]?.status).toBe("needs_evidence");
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("softenExtractionResponse()", () => {
  it("корректный ответ -> без смягчений", () => {
    const result = softenExtractionResponse({ claims: [validClaim()] }, extractionResponseSchema);

    expect(result.data).not.toBeNull();
    expect(result.data?.claims).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it("category achievement_metric -> result, warning", () => {
    const result = softenExtractionResponse(
      { claims: [validClaim({ category: "achievement_metric" })] },
      extractionResponseSchema,
    );

    expect(result.data?.claims[0]?.category).toBe("result");
    expect(result.warnings.join(" ")).toContain("category");
  });

  it("status supported -> needs_evidence, warning", () => {
    const result = softenExtractionResponse(
      { claims: [validClaim({ status: "supported" })] },
      extractionResponseSchema,
    );

    expect(result.data?.claims[0]?.status).toBe("needs_evidence");
    expect(result.warnings.join(" ")).toContain("status");
  });

  it("отсутствует number -> null, warning", () => {
    const result = softenExtractionResponse({ claims: [validClaim({ number: undefined })] }, extractionResponseSchema);

    expect(result.data?.claims[0]?.number).toBeNull();
    expect(result.warnings.join(" ")).toContain("number");
  });

  it("отсутствуют metric_type и currency -> иное и null, warnings", () => {
    const result = softenExtractionResponse(
      { claims: [validClaim({ metric_type: undefined, currency: undefined })] },
      extractionResponseSchema,
    );

    expect(result.data?.claims[0]?.metric_type).toBe("иное");
    expect(result.data?.claims[0]?.currency).toBeNull();
    expect(result.warnings.join(" ")).toContain("metric_type");
    expect(result.warnings.join(" ")).toContain("currency");
  });

  it("полностью невалидный ответ -> null с ошибкой", () => {
    const result = softenExtractionResponse({ foo: "bar" }, extractionResponseSchema);

    expect(result.data).toBeNull();
    expect(result.warnings.join(" ")).toContain("schema mismatch");
    expect(result.warnings.join(" ")).toContain("claims");
  });
});
