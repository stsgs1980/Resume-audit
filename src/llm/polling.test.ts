import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmTransport } from "./client";
import { waitForAssistant } from "./polling";

/** Мутируемый mock-транспорт. */
interface MockTransport extends LlmTransport {
  setResponse(body: unknown): void;
  calls(): number;
}

/**
 * Создаёт транспорт с ответом GET /session/:id/message.
 *
 * @param initial - начальное тело ответа
 * @returns mock-транспорт
 */
function mockTransport(initial: unknown): MockTransport {
  let response = initial;
  let calls = 0;

  return {
    get: () => {
      calls += 1;

      return Promise.resolve(response);
    },
    post: () => Promise.resolve({}),
    setResponse: (body) => {
      response = body;
    },
    calls: () => calls,
  };
}

/**
 * Собирает ответ сервера с сообщениями.
 *
 * @param messagesList - сообщения
 * @returns конверт { data }
 */
function messages(messagesList: unknown[]): unknown {
  return { data: messagesList };
}

/**
 * Assistant-сообщение с частями content.
 *
 * @param parts - части content
 * @returns сообщение
 */
function assistant(parts: unknown[]): unknown {
  return { type: "assistant", content: parts };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("waitForAssistant()", () => {
  it("одна text-часть -> возвращает её", async () => {
    const transport = mockTransport(messages([assistant([{ type: "text", text: '{"a":1}' }])]));
    const promise = waitForAssistant(transport, "ses_1", 5000);

    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toEqual({ text: '{"a":1}' });
  });

  it("reasoning и text -> возвращает text, не reasoning", async () => {
    const transport = mockTransport(
      messages([
        assistant([
          { type: "reasoning", text: "думаю" },
          { type: "text", text: '{"claims":[]}' },
        ]),
      ]),
    );
    const promise = waitForAssistant(transport, "ses_1", 5000);

    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toEqual({ text: '{"claims":[]}' });
  });

  it("только reasoning -> ждёт следующий поллинг", async () => {
    const transport = mockTransport(messages([assistant([{ type: "reasoning", text: "думаю" }])]));
    let settled = false;
    const promise = waitForAssistant(transport, "ses_1", 5000);
    void promise.finally(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(500);

    expect(settled).toBe(false);

    transport.setResponse(messages([assistant([{ type: "text", text: '{"claims":[]}' }])]));
    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toEqual({ text: '{"claims":[]}' });
    expect(transport.calls()).toBe(2);
  });

  it("первое сообщение с reasoning, второе с text -> возвращает text второго", async () => {
    const transport = mockTransport(
      messages([
        assistant([{ type: "reasoning", text: "думаю" }]),
        assistant([{ type: "text", text: '{"claims":[]}' }]),
      ]),
    );
    const promise = waitForAssistant(transport, "ses_1", 5000);

    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toEqual({ text: '{"claims":[]}' });
  });

  it("игнорирует старый text до prompt-сообщения", async () => {
    const oldAssistant = {
      id: "msg_old",
      type: "assistant",
      time: { created: 1 },
      content: [{ type: "text", text: '{"old":true}' }],
    };
    const prompt = { id: "msg_prompt", type: "user", time: { created: 2 } };
    const transport = mockTransport(messages([prompt, oldAssistant]));
    let settled = false;
    const promise = waitForAssistant(transport, "ses_1", 5000, "msg_prompt");
    void promise.finally(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(500);

    expect(settled).toBe(false);

    transport.setResponse(
      messages([
        {
          id: "msg_new",
          type: "assistant",
          time: { created: 3 },
          content: [{ type: "text", text: '{"new":true}' }],
        },
        prompt,
        oldAssistant,
      ]),
    );
    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toEqual({ text: '{"new":true}' });
  });
});
