import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

let cachedPassword: string | null = null;

/**
 * Путь к service.json по умолчанию.
 *
 * @returns путь ~/.config/opencode/service.json
 */
export function defaultServicePath(): string {
  return join(homedir(), ".config", "opencode", "service.json");
}

/**
 * Читает пароль сервиса. Дефолтный путь кэшируется в памяти.
 *
 * @param servicePath - явный путь (без кэша) или дефолт
 * @returns пароль из поля password
 */
export async function readServicePassword(servicePath?: string): Promise<string> {
  const target = servicePath ?? defaultServicePath();

  if (servicePath === undefined && cachedPassword !== null) {
    return cachedPassword;
  }

  let text: string;

  try {
    text = await readFile(target, "utf8");
  } catch {
    throw new Error(`LLM service file not found: ${target}`);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`LLM service file is not JSON: ${target}`);
  }

  const password =
    typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>)["password"] : undefined;

  if (typeof password !== "string" || password.length === 0) {
    throw new Error(`LLM service file has no password: ${target}`);
  }

  if (servicePath === undefined) {
    cachedPassword = password;
  }

  return password;
}

/**
 * Строит заголовок Basic-авторизации.
 *
 * @param password - пароль сервиса
 * @returns значение заголовка Authorization
 */
export function buildAuthHeader(password: string): string {
  return `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`;
}

/**
 * Сбрасывает кэш пароля (для тестов).
 */
export function resetAuthCache(): void {
  cachedPassword = null;
}
