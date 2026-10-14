import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createMockFetch, resetFetchAfterEach } from "./__mocks__/mock-fetch";
import { createFetchLlmClient, createLlmClient } from "./client";
import type { LlmConfig } from "./types";

resetFetchAfterEach();

const config: LlmConfig = {
  baseUrl: "http://127.0.0.1:49374/api",
  model: "opencode/space-bunny-free",
  retryCount: 2,
  timeoutMs: 5000,
};

const assistantMessages = (text: string) => ({
  data: [{ type: "assistant", content: [{ type: "text", text }] }],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("health()", () => {
  it("true на 200 + version", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson({ version: "2.0.28" });

    const client = createFetchLlmClient(config, { password: "pw" });

    expect(await client.health()).toBe(true);
  });

  it("false на ошибке сети", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.failNext(new Error("down"));

    const client = createFetchLlmClient(config, { password: "pw" });

    expect(await client.health()).toBe(false);
  });

  it("false на HTTP 500", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson({}, 500);

    const client = createFetchLlmClient(config, { password: "pw" });

    expect(await client.health()).toBe(false);
  });
});

describe("createFetchLlmClient", () => {
  it("отклоняет baseUrl без /api", () => {
    expect(() => createFetchLlmClient({ ...config, baseUrl: "http://x:1" })).toThrow(/\/api/);
  });

  it("createLlmClient — тот же контракт", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson({ version: "2.0.28" });

    expect(await createLlmClient(config, { password: "pw" }).health()).toBe(true);
  });
});

describe("call()", () => {
  it("при отсутствии сессии создаёт её и возвращает данные", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson({ data: { id: "ses_1", time: { created: 1 } } });
    mock.respondJson({ data: { id: "msg_1" } });
    mock.respondJson(assistantMessages('{"greeting":"hi"}'));

    const client = createFetchLlmClient(config, { password: "pw" });
    const result = await client.call({
      system: "s",
      user: "u",
      schema: z.object({ greeting: z.string() }),
    });

    expect(result).toEqual({ ok: true, data: { greeting: "hi" } });
    expect(mock.requests[0]?.url.endsWith("/session")).toBe(true);
  });

  it("таймаут возвращает kind timeout", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson({ data: { id: "ses_1", time: { created: 1 } } });
    mock.hangNext();

    const client = createFetchLlmClient({ ...config, timeoutMs: 50 }, { password: "pw" });
    const result = await client.call({
      system: "s",
      user: "u",
      schema: z.object({ greeting: z.string() }),
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.kind).toBe("timeout");
    }
  });

  it("ошибка сети возвращает kind unavailable", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.failNext(new Error("down"));

    const client = createFetchLlmClient(config, { password: "pw" });
    const result = await client.call({
      system: "s",
      user: "u",
      schema: z.object({ greeting: z.string() }),
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.kind).toBe("unavailable");
    }
  });
});
