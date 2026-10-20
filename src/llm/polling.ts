import type { LlmTransport } from "./client";
import { LlmTransportError, unwrapEnvelope } from "./types";

/** Пауза между опросами сообщений, мс. */
const POLL_INTERVAL_MS = 500;

/**
 * Проверяет, что значение является объектом.
 *
 * @param value - проверяемое значение
 * @returns true для обычного объекта
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Достаёт время создания сообщения.
 *
 * @param message - сообщение
 * @returns миллисекунды или null
 */
function messageCreated(message: unknown): number | null {
  if (!isRecord(message) || !isRecord(message["time"])) {
    return null;
  }

  const created = message["time"]["created"];

  return typeof created === "number" ? created : null;
}

/**
 * Оставляет только сообщения, созданные после prompt-сообщения.
 *
 * @param messages - все сообщения сессии
 * @param sinceMessageId - id prompt-сообщения
 * @returns сообщения нового ответа
 */
function messagesForPrompt(messages: unknown[], sinceMessageId?: string): unknown[] {
  if (sinceMessageId === undefined) {
    return messages;
  }

  const markerIndex = messages.findIndex((message) => isRecord(message) && message["id"] === sinceMessageId);

  if (markerIndex < 0) {
    return [];
  }

  const markerCreated = messageCreated(messages[markerIndex]);

  if (markerCreated !== null) {
    return messages.filter((message, index) => {
      if (index === markerIndex) {
        return false;
      }

      const created = messageCreated(message);

      return created !== null && created >= markerCreated;
    });
  }

  return messages.slice(0, markerIndex);
}

/**
 * Достаёт текст первого текстового фрагмента ассистента.
 *
 * @param message - сообщение 2.0.28 или SDK-формы
 * @returns текст или null
 */
function messageText(message: unknown): string | null {
  if (typeof message !== "object" || message === null) {
    return null;
  }

  const record = message as Record<string, unknown>;
  const direct = record["content"] ?? record["parts"];
  const nested = (record["info"] as Record<string, unknown> | undefined)?.["parts"];
  const parts = Array.isArray(direct) ? direct : Array.isArray(nested) ? nested : [];

  for (const part of parts) {
    const recordPart = part as Record<string, unknown>;

    if (recordPart["type"] !== "text") {
      continue;
    }

    const text = recordPart["text"];

    if (typeof text === "string" && text.length > 0) {
      return text;
    }
  }

  if (record["type"] === "assistant" && typeof record["text"] === "string") {
    return record["text"];
  }

  return null;
}

/**
 * Достаёт ошибку ассистента из списка сообщений.
 *
 * @param messages - список сообщений
 * @returns ошибка или null
 */
function assistantError(messages: unknown): unknown {
  if (!Array.isArray(messages)) {
    return null;
  }

  for (const message of messages) {
    if (typeof message === "object" && message !== null && "error" in message) {
      const error = (message as Record<string, unknown>)["error"];

      if (error !== null && error !== undefined) {
        return error;
      }
    }
  }

  return null;
}

/**
 * Ждёт текст ассистента polling-опросом сообщений.
 *
 * @param transport - транспорт
 * @param sessionId - id сессии
 * @param timeoutMs - общий лимит ожидания
 * @param sinceMessageId - id prompt-сообщения, после которого ждём ответ
 * @returns текст ассистента или его ошибка
 */
export async function waitForAssistant(
  transport: LlmTransport,
  sessionId: string,
  timeoutMs: number,
  sinceMessageId?: string,
): Promise<{ text: string } | { assistantError: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (;;) {
      if (controller.signal.aborted) {
        throw new LlmTransportError("timeout", `LLM poll timed out: session ${sessionId}`);
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const body = unwrapEnvelope<unknown>(await transport.get(`/session/${sessionId}/message`, controller.signal));
      const messages = Array.isArray(body) ? body : [];
      const fresh = messagesForPrompt(messages, sinceMessageId);
      const text = fresh.map(messageText).find((entry) => entry !== null);

      if (text !== undefined && text !== null) {
        return { text };
      }

      const error = assistantError(fresh);

      if (error !== null) {
        return { assistantError: error };
      }
    }
  } finally {
    clearTimeout(timer);
  }
}
