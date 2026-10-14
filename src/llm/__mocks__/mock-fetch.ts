/** Очередный fake fetch для тестов llm: записывает запросы, отдаёт заготовки. */

import { afterEach, vi } from "vitest";

/** Записанный запрос. */
export interface RecordedRequest {
  /** URL запроса. */
  url: string;
  /** HTTP-метод. */
  method: string;
  /** Распарсенное JSON-тело (или null). */
  body: unknown;
}

/** Один сценарий ответа. */
type Planned = { kind: "json"; data: unknown; status: number } | { kind: "throw"; error: Error } | { kind: "hang" };

/**
 * Создаёт mock fetch с очередью ответов.
 *
 * @returns mock fetch, журнал запросов и методы постановки ответов
 */
export function createMockFetch() {
  const requests: RecordedRequest[] = [];
  const queue: Planned[] = [];

  const parseBody = (init: RequestInit | undefined): unknown => {
    if (typeof init?.body !== "string") {
      return null;
    }

    try {
      return JSON.parse(init.body) as unknown;
    } catch {
      return null;
    }
  };

  const fake = (async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const target = typeof url === "string" ? url : url.toString();
    const next = queue.shift() ?? { kind: "json", data: { error: "empty-mock-queue" }, status: 500 };

    requests.push({ url: target, method: init?.method ?? "GET", body: parseBody(init) });

    if (next.kind === "throw") {
      throw next.error;
    }

    if (next.kind === "hang") {
      return new Promise<never>(() => undefined);
    }

    return new Response(JSON.stringify(next.data), {
      status: next.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;

  return {
    fetch: fake,
    requests,
    /**
     * Ставит JSON-ответ в очередь.
     *
     * @param data - тело ответа
     * @param status - HTTP-статус
     */
    respondJson(data: unknown, status = 200): void {
      queue.push({ kind: "json", data, status });
    },
    /**
     * Ставит ошибку сети в очередь.
     *
     * @param error - бросаемая ошибка
     */
    failNext(error: Error): void {
      queue.push({ kind: "throw", error });
    },
    /** Ставит вечно висящий запрос в очередь (для тестов таймаута). */
    hangNext(): void {
      queue.push({ kind: "hang" });
    },
  };
}

/**
 * Регистрирует afterEach-сброс глобального fetch.
 */
export function resetFetchAfterEach(): void {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
}
