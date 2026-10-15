import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createMockFetch, resetFetchAfterEach } from "./__mocks__/mock-fetch";
import { createFetchLlmClient, createLlmClient } from "./client";
import type { LlmLogEntry } from "./logger";
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

describe("call() с логированием", () => {
  let dir = "";

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "llm-client-log-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const logConfig = () => ({ logDir: dir, maxFileSizeBytes: 5_000_000, maxFiles: 3 });

  const readEntry = async (): Promise<LlmLogEntry> =>
    JSON.parse(await readFile(join(dir, "model-responses.log"), "utf8")) as LlmLogEntry;

  it("пишет запись с stage, длинами и attempts", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson({ data: { id: "ses_1", time: { created: 1 } } });
    mock.respondJson({ data: { id: "msg_1" } });
    mock.respondJson(assistantMessages('{"greeting":"hi"}'));

    const client = createFetchLlmClient(config, { password: "pw", logConfig: logConfig() });
    const result = await client.call({
      system: "sys",
      user: "usr",
      schema: z.object({ greeting: z.string() }),
      stage: "extraction",
    });

    expect(result.ok).toBe(true);

    const logged = await readEntry();

    expect(logged).toMatchObject({
      stage: "extraction",
      model: config.model,
      promptLength: 6,
      attempts: 1,
      ok: true,
      errorKind: null,
    });
    expect(logged.responseLength).toBeGreaterThan(0);
    expect(logged.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("без logConfig ничего не пишет", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson({ data: { id: "ses_1", time: { created: 1 } } });
    mock.respondJson({ data: { id: "msg_1" } });
    mock.respondJson(assistantMessages('{"greeting":"hi"}'));

    const client = createFetchLlmClient(config, { password: "pw" });

    await client.call({ system: "s", user: "u", schema: z.object({ greeting: z.string() }) });

    expect(await readdir(dir)).toEqual([]);
  });

  it("ошибка записи лога не ломает вызов", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson({ data: { id: "ses_1", time: { created: 1 } } });
    mock.respondJson({ data: { id: "msg_1" } });
    mock.respondJson(assistantMessages('{"greeting":"hi"}'));

    const blockerFile = join(dir, "blocker-file");

    await writeFile(blockerFile, "x", "utf8");

    const client = createFetchLlmClient(config, {
      password: "pw",
      logConfig: { logDir: join(blockerFile, "sub"), maxFileSizeBytes: 10, maxFiles: 3 },
    });

    const result = await client.call({
      system: "s",
      user: "u",
      schema: z.object({ greeting: z.string() }),
    });

    expect(result.ok).toBe(true);
  });

  it("при неуспехе пишет errorKind", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson({ data: { id: "ses_1", time: { created: 1 } } });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      mock.respondJson({ data: { id: "msg_1" } });
      mock.respondJson(assistantMessages("not json"));
    }

    const client = createFetchLlmClient(config, { password: "pw", logConfig: logConfig() });

    await client.call({ system: "s", user: "u", schema: z.object({ greeting: z.string() }) });

    const logged = await readEntry();

    expect(logged).toMatchObject({ ok: false, errorKind: "structured-output", attempts: 3 });
  });
});
