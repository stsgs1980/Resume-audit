import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createMockFetch, resetFetchAfterEach } from "./__mocks__/mock-fetch";
import { createLlmTransport } from "./client";
import { callWithSchema, extractJson, withTimeout } from "./structured-output";
import type { LlmConfig, SessionInfo } from "./types";

resetFetchAfterEach();

const config: LlmConfig = {
  baseUrl: "http://127.0.0.1:49374/api",
  model: "opencode/space-bunny-free",
  retryCount: 2,
  timeoutMs: 5000,
};

const session: SessionInfo = { id: "ses_1", createdAt: "" };
const params = { system: "s", user: "u", schema: z.object({ a: z.number() }) };

const accept = { data: { id: "msg_1" } };
const assistant = (text: string) => ({
  data: [{ type: "assistant", content: [{ type: "text", text }] }],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractJson()", () => {
  it("голый объект", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("объект в markdown-обёртке", () => {
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });

  it("массив", () => {
    expect(extractJson('[{"a":3}]')).toEqual([{ a: 3 }]);
  });

  it("мусор -> null", () => {
    expect(extractJson("no json here")).toBeNull();
  });
});

describe("withTimeout()", () => {
  it("отклоняет висящий промис", async () => {
    await expect(withTimeout(new Promise<never>(() => undefined), 20)).rejects.toThrow(/Timed out/);
  });

  it("пропускает быстрый результат", async () => {
    await expect(withTimeout(Promise.resolve(7), 100)).resolves.toBe(7);
  });
});

describe("callWithSchema()", () => {
  it("ok: true с валидными данными", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson(accept);
    mock.respondJson(assistant('{"a":1}'));

    const result = await callWithSchema(createLlmTransport(config.baseUrl, "pw"), config, session, params);

    expect(result).toEqual({ ok: true, data: { a: 1 } });
  });

  it("JSON в markdown-обёртке извлекается", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson(accept);
    mock.respondJson(assistant('```json\n{"a":5}\n```'));

    const result = await callWithSchema(createLlmTransport(config.baseUrl, "pw"), config, session, params);

    expect(result).toEqual({ ok: true, data: { a: 5 } });
  });

  it("невалидный JSON -> retry -> ok: false", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      mock.respondJson(accept);
      mock.respondJson(assistant("not json"));
    }

    const result = await callWithSchema(createLlmTransport(config.baseUrl, "pw"), config, session, params);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.kind).toBe("structured-output");
    }

    expect(mock.requests.filter((request) => request.method === "POST")).toHaveLength(3);
  });

  it("Zod fail -> retry -> ok: false", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      mock.respondJson(accept);
      mock.respondJson(assistant('{"a":"nan"}'));
    }

    const result = await callWithSchema(
      createLlmTransport(config.baseUrl, "pw"),
      { ...config, retryCount: 2 },
      session,
      params,
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.kind).toBe("structured-output");
    }
  });

  it("таймаут -> ok: false, kind timeout", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.hangNext();

    const result = await callWithSchema(
      createLlmTransport(config.baseUrl, "pw"),
      { ...config, timeoutMs: 50 },
      session,
      params,
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.kind).toBe("timeout");
    }
  });

  it("ошибка ассистента (квота) -> ok: false без ретраев", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson(accept);
    mock.respondJson({
      data: [{ type: "assistant", error: { type: "provider.quota", message: "402" } }],
    });

    const result = await callWithSchema(createLlmTransport(config.baseUrl, "pw"), config, session, params);

    expect(result.ok).toBe(false);
    expect(mock.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  });
});
