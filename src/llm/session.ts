import type { LlmTransport } from "./client";
import type { LlmConfig, SessionInfo } from "./types";
import { unwrapEnvelope } from "./types";

/**
 * Разбирает "providerID/modelID" из конфига.
 *
 * @param model - модель конфига
 * @returns пара для тела create
 */
function parseModel(model: string): { providerID: string; id: string } {
  const separator = model.indexOf("/");

  if (separator < 0) {
    return { providerID: "opencode", id: model };
  }

  return { providerID: model.slice(0, separator), id: model.slice(separator + 1) };
}

/**
 * Health-check: GET {baseUrl}/info, 200 + version -> true.
 *
 * @param transport - транспорт
 * @param config - конфиг LLM
 * @returns true, если сервер жив
 */
export async function health(transport: LlmTransport, config: LlmConfig): Promise<boolean> {
  void config;

  try {
    const body = unwrapEnvelope<Record<string, unknown>>(await transport.get("/info"));
    const info = unwrapEnvelope<Record<string, unknown>>(body);

    return typeof info.version === "string";
  } catch {
    return false;
  }
}

/**
 * Создаёт сессию: POST {baseUrl}/session с анврапом конверта.
 *
 * @param transport - транспорт
 * @param config - конфиг LLM (модель уходит в тело create)
 * @param title - заголовок сессии
 * @returns информация о сессии
 */
export async function createSession(transport: LlmTransport, config: LlmConfig, title: string): Promise<SessionInfo> {
  const reference = parseModel(config.model);
  const body = unwrapEnvelope<{ id: string; time?: { created?: number } }>(
    await transport.post("/session", {
      title,
      model: { id: reference.id, providerID: reference.providerID },
    }),
  );
  const created = typeof body.time?.created === "number" ? body.time.created : null;

  return { id: body.id, createdAt: created === null ? "" : new Date(created).toISOString() };
}

/**
 * Проверяет сессию чтением: GET {baseUrl}/session/{id}.
 *
 * @param transport - транспорт
 * @param sessionId - id сессии
 */
async function checkSession(transport: LlmTransport, sessionId: string): Promise<void> {
  await transport.get(`/session/${sessionId}`);
}

/**
 * Возвращает живую сессию: есть — проверить, нет — создать.
 *
 * @param transport - транспорт
 * @param config - конфиг LLM
 * @param current - текущая сессия или null
 * @param title - заголовок для новой сессии
 * @returns живая сессия
 */
export async function ensureAlive(
  transport: LlmTransport,
  config: LlmConfig,
  current: SessionInfo | null,
  title: string,
): Promise<SessionInfo> {
  if (current !== null) {
    try {
      await checkSession(transport, current.id);

      return current;
    } catch {
      // Сессия мертва — пересоздать ниже.
    }
  }

  return createSession(transport, config, title);
}
