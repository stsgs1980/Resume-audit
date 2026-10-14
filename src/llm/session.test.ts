import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockFetch, resetFetchAfterEach } from "./__mocks__/mock-fetch";
import { createLlmTransport } from "./client";
import { createSession, ensureAlive, health } from "./session";
import type { LlmConfig } from "./types";

resetFetchAfterEach();

const config: LlmConfig = {
  baseUrl: "http://127.0.0.1:49374/api",
  model: "opencode/space-bunny-free",
  retryCount: 2,
  timeoutMs: 5000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("health()", () => {
  it("true на 200 + version", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson({ version: "2.0.28" });

    expect(await health(createLlmTransport(config.baseUrl, "pw"), config)).toBe(true);
  });

  it("false на 500", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson({}, 500);

    expect(await health(createLlmTransport(config.baseUrl, "pw"), config)).toBe(false);
  });
});

describe("createSession()", () => {
  it("POST /api/session и анврап конверта {data}", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson({ data: { id: "ses_9", time: { created: 1792000000000 } } });

    const session = await createSession(createLlmTransport(config.baseUrl, "pw"), config, "audit-run");

    expect(session.id).toBe("ses_9");
    expect(session.createdAt).toBe(new Date(1792000000000).toISOString());
    expect(mock.requests[0]).toMatchObject({ method: "POST" });
    expect(mock.requests[0]?.url.endsWith("/session")).toBe(true);
  });
});

describe("ensureAlive()", () => {
  it("без сессии — создаёт", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson({ data: { id: "ses_new", time: { created: 1 } } });

    const session = await ensureAlive(createLlmTransport(config.baseUrl, "pw"), config, null, "audit-run");

    expect(session.id).toBe("ses_new");
  });

  it("живая сессия — возвращается как есть, без POST", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson({ data: { id: "ses_1" } });

    const current = { id: "ses_1", createdAt: "" };
    const session = await ensureAlive(createLlmTransport(config.baseUrl, "pw"), config, current, "audit-run");

    expect(session).toBe(current);
    expect(mock.requests).toHaveLength(1);
  });

  it("ошибка проверки — пересоздаёт", async () => {
    const mock = createMockFetch();

    vi.stubGlobal("fetch", mock.fetch);
    mock.respondJson({ error: "gone" }, 404);
    mock.respondJson({ data: { id: "ses_2", time: { created: 2 } } });

    const session = await ensureAlive(
      createLlmTransport(config.baseUrl, "pw"),
      config,
      { id: "ses_dead", createdAt: "" },
      "audit-run",
    );

    expect(session.id).toBe("ses_2");
  });
});
