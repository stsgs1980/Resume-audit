import type { ZodType } from "zod";
import { buildAuthHeader, readServicePassword } from "./auth";
import { health as checkHealth, ensureAlive } from "./session";
import { callWithSchema } from "./structured-output";
import type { LlmCallResult, LlmConfig, SessionInfo } from "./types";
import { LlmTransportError } from "./types";

/** Минимальный транспорт поверх fetch (для будущей замены на SDK). */
export interface LlmTransport {
  /**
   * GET-запрос с разбором JSON.
   */
  get(path: string, signal?: AbortSignal): Promise<unknown>;
  /**
   * POST-запрос с разбором JSON.
   */
  post(path: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
}

/** Тонкий интерфейс LLM-клиента: сигнатуры не меняются при переходе на SDK. */
export interface LlmClient {
  /** Проверка живости сервера. */
  health(): Promise<boolean>;
  /** Вызов с structured output (сессия создаётся при отсутствии). */
  call<T>(params: { system: string; user: string; schema: ZodType<T> }): Promise<LlmCallResult<T>>;
}

/** Опции фабрики клиента. */
export interface LlmClientOptions {
  /** Пароль сервиса (иначе читается из service.json с кэшем). */
  password?: string;
}

/** Заголовок сессии по умолчанию. */
const DEFAULT_SESSION_TITLE = "resume-audit";

/**
 * Проверяет, является ли ошибка прерыванием по таймауту.
 *
 * @param error - пойманная ошибка
 * @param signal - сигнал запроса
 * @returns true для abort/timeout
 */
function isTimeoutCause(error: unknown, signal?: AbortSignal): boolean {
  return (error as Error).name === "AbortError" || signal?.aborted === true;
}

/**
 * Создаёт транспорт поверх globalThis.fetch.
 *
 * @param baseUrl - базовый URL с /api
 * @param password - пароль сервиса или функция его получения
 * @returns транспорт
 */
export function createLlmTransport(baseUrl: string, password: string | (() => Promise<string>)): LlmTransport {
  const resolvePassword = async (): Promise<string> => (typeof password === "string" ? password : password());

  const request = async (method: string, path: string, body: unknown, signal?: AbortSignal): Promise<unknown> => {
    const header = buildAuthHeader(await resolvePassword());
    let response: Response;

    try {
      response = await globalThis.fetch(`${baseUrl}${path}`, {
        method,
        headers: { "Content-Type": "application/json", Authorization: header },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (isTimeoutCause(error, signal)) {
        throw new LlmTransportError("timeout", `LLM request timed out: ${method} ${path}`);
      }

      throw new LlmTransportError("unavailable", `LLM request failed: ${(error as Error).message}`);
    }

    if (!response.ok) {
      throw new LlmTransportError("unavailable", `LLM HTTP ${response.status}: ${method} ${path}`);
    }

    try {
      return (await response.json()) as unknown;
    } catch {
      throw new LlmTransportError("unavailable", `LLM invalid JSON: ${method} ${path}`);
    }
  };

  return {
    get: (path, signal) => request("GET", path, undefined, signal),
    post: (path, body, signal) => request("POST", path, body, signal),
  };
}

/**
 * Создаёт fetch-клиент. baseUrl обязан содержать /api.
 *
 * @param config - конфиг LLM
 * @param options - пароль для тестов (иначе service.json)
 * @returns тонкий клиент
 */
export function createFetchLlmClient(config: LlmConfig, options?: LlmClientOptions): LlmClient {
  if (!config.baseUrl.includes("/api")) {
    throw new Error(`LLM baseUrl must contain /api: ${config.baseUrl}`);
  }

  const getPassword = (): Promise<string> => {
    if (options?.password !== undefined) {
      return Promise.resolve(options.password);
    }

    return readServicePassword();
  };
  const transport = createLlmTransport(config.baseUrl, getPassword);
  let session: SessionInfo | null = null;

  const toResult = (error: unknown): LlmCallResult<never> => {
    if (error instanceof LlmTransportError) {
      return { ok: false, error: { kind: error.kind, message: error.message } };
    }

    return { ok: false, error: { kind: "unknown", message: (error as Error).message } };
  };

  return {
    health: () => checkHealth(transport, config),
    call: async (params) => {
      try {
        session = await ensureAlive(transport, config, session, DEFAULT_SESSION_TITLE);
      } catch (error) {
        return toResult(error);
      }

      return callWithSchema(transport, config, session, params);
    },
  };
}

/**
 * Фабрика клиента (алиас fetch-реализации; сигнатура стабильна для SDK).
 *
 * @param config - конфиг LLM
 * @param options - пароль для тестов
 * @returns тонкий клиент
 */
export function createLlmClient(config: LlmConfig, options?: LlmClientOptions): LlmClient {
  return createFetchLlmClient(config, options);
}
