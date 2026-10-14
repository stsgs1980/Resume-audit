import type { ZodType } from "zod";
import type { LlmTransport } from "./client";
import { waitForAssistant } from "./polling";
import type { LlmCallResult, LlmConfig, SessionInfo } from "./types";
import { LlmTransportError } from "./types";

/** Суффикс ретрая: напоминание вернуть только JSON. */
const RETRY_SUFFIX = "\n\nПредыдущий ответ не прошёл проверку. Верни ТОЛЬКО валидный JSON, без пояснений.";

/**
 * Извлекает JSON из текста: сначала кодовый блок, затем скобки.
 *
 * @param text - текст ответа ассистента
 * @returns распарсенное значение или null
 */
export function extractJson(text: string): unknown | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);

  if (fenced?.[1] !== undefined) {
    try {
      return JSON.parse(fenced[1]) as unknown;
    } catch {
      // Падать ниже к поиску по скобкам.
    }
  }

  const opens = [text.indexOf("{"), text.indexOf("[")].filter((index) => index >= 0);
  const closes = [text.lastIndexOf("}"), text.lastIndexOf("]")].filter((index) => index >= 0);

  if (opens.length === 0 || closes.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text.slice(Math.min(...opens), Math.max(...closes) + 1)) as unknown;
  } catch {
    return null;
  }
}

/**
 * Оборачивает промис таймаутом через race + setTimeout.
 *
 * @param promise - ожидаемый промис
 * @param ms - лимит в миллисекундах
 * @returns результат промиса или throw по таймауту
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settle = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  void promise.then(settle, settle);

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });

  return Promise.race([promise, timeout]);
}

/**
 * Строит текст промпта: system + user + требование только JSON.
 *
 * @param system - системная инструкция
 * @param user - пользовательский запрос
 * @param isRetry - добавить напоминание после неуспеха
 * @returns текст для POST prompt
 */
function buildPromptText(system: string, user: string, isRetry: boolean): string {
  const suffix = isRetry ? RETRY_SUFFIX : "";

  return `${system}\n\n${user}${suffix}\n\nВерни ТОЛЬКО JSON.`;
}

/**
 * Вызов с structured output: POST prompt, polling, парсинг, Zod, retry.
 *
 * @param transport - транспорт
 * @param config - конфиг LLM (retryCount, timeoutMs)
 * @param session - сессия прогона
 * @param params - system, user и Zod-схема ответа
 * @param params.system - системная инструкция
 * @param params.user - пользовательский запрос
 * @param params.schema - Zod-схема ответа
 * @returns валидные данные или типированная ошибка
 */
export async function callWithSchema<T>(
  transport: LlmTransport,
  config: LlmConfig,
  session: SessionInfo,
  params: { system: string; user: string; schema: ZodType<T> },
): Promise<LlmCallResult<T>> {
  const attempts = config.retryCount + 1;
  let lastReason = "empty response";

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const posted = await withTimeout(
        transport.post(
          `/session/${session.id}/prompt`,
          { text: buildPromptText(params.system, params.user, attempt > 0) },
          controller.signal,
        ),
        config.timeoutMs,
      );
      void posted;

      const waited = await withTimeout(waitForAssistant(transport, session.id, config.timeoutMs), config.timeoutMs);

      if ("assistantError" in waited) {
        return {
          ok: false,
          error: {
            kind: "unknown",
            message: "LLM assistant error",
            details: waited.assistantError,
          },
        };
      }

      const parsed = extractJson(waited.text);

      if (parsed === null) {
        lastReason = "response is not JSON";

        continue;
      }

      const validated = params.schema.safeParse(parsed);

      if (!validated.success) {
        lastReason = `schema mismatch: ${JSON.stringify(validated.error.issues)}`;

        continue;
      }

      return { ok: true, data: validated.data };
    } catch (error) {
      if (error instanceof LlmTransportError && error.kind === "timeout") {
        return { ok: false, error: { kind: "timeout", message: error.message } };
      }

      if ((error as Error).name === "AbortError" || (error as Error).message.startsWith("Timed out")) {
        return { ok: false, error: { kind: "timeout", message: (error as Error).message } };
      }

      return {
        ok: false,
        error: { kind: "unavailable", message: (error as Error).message },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    error: { kind: "structured-output", message: `LLM structured output failed: ${lastReason}` },
  };
}
