import { describe, expect, it } from "vitest";
import type { LlmClient } from "../../llm/client";
import type { LlmCallResult } from "../../llm/types";
import type { FileEntry } from "../stage1/types";
import { extractClaimsFromFile } from "./extract";

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

    expect(result).toEqual({ claims: [], error: "down" });
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

    expect(result).toEqual({ claims, error: null });
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
});
