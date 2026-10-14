/** Конфигурация LLM-клиента. */
export interface LlmConfig {
  /** Базовый URL сервера с суффиксом /api. */
  baseUrl: string;
  /** Модель вида "providerID/modelID". */
  model: string;
  /** Число ретраев structured output (помимо первой попытки). */
  retryCount: number;
  /** Таймаут одного вызова в миллисекундах. */
  timeoutMs: number;
}

/** Таймаут генерации по умолчанию: 180 секунд. */
export const DEFAULT_GENERATE_TIMEOUT_MS = 180_000;

/** Таймаут оценки по умолчанию: 60 секунд. */
export const DEFAULT_EVAL_TIMEOUT_MS = 60_000;

/** Ошибка транспорта (сеть, HTTP, таймаут) с видом для мэппинга. */
export class LlmTransportError extends Error {
  /** Вид транспортной ошибки. */
  readonly kind: "unavailable" | "timeout";

  /**
   * @param kind - вид ошибки
   * @param message - сообщение без содержимого промптов
   */
  constructor(kind: "unavailable" | "timeout", message: string) {
    super(message);
    this.name = "LlmTransportError";
    this.kind = kind;
  }
}

/**
 * Разворачивает конверт { data } сервера 2.0.28.
 *
 * @param body - тело ответа
 * @returns внутренность конверта или само тело
 */
export function unwrapEnvelope<T>(body: unknown): T {
  if (typeof body === "object" && body !== null && "data" in body) {
    return (body as { data: T }).data;
  }

  return body as T;
}

/** Вид ошибки LLM-вызова. */
export type LlmErrorKind = "unavailable" | "structured-output" | "timeout" | "unknown";

/** Ошибка LLM-вызова. */
export interface LlmError {
  /** Вид ошибки. */
  kind: LlmErrorKind;
  /** Человекочитаемое сообщение (без содержимого промптов). */
  message: string;
  /** Детали для отладки (без записи в файлы). */
  details?: unknown;
}

/** Результат LLM-вызова. */
export type LlmCallResult<T> = { ok: true; data: T } | { ok: false; error: LlmError };

/** Информация о сессии. */
export interface SessionInfo {
  /** Id сессии вида "ses_...". */
  id: string;
  /** Время создания в ISO. */
  createdAt: string;
}

/** Статус чекпоинта этапа. */
export type CheckpointStatus = "running" | "completed" | "failed" | "incomplete";

/** Чекпоинт этапа конвейера. */
export interface Checkpoint {
  /** Id этапа. */
  stageId: string;
  /** Статус этапа. */
  status: CheckpointStatus;
  /** Время обновления в ISO. */
  updatedAt: string;
}
