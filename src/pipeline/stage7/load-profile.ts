import { join } from "node:path";
import { loadRoleConfig } from "../stage3/ats";
import type { GenerationRoleId } from "./types";

/** Профиль роли для генерации. */
export interface RoleProfile {
  /** Id роли. */
  id: string;
  /** Название. */
  title: string;
  /** Правила навыков. */
  skillsRules: { always: string[]; [role: string]: string[] };
  /** ATS-ключи. */
  atsKeywords?: { mandatory: string[]; optional: string[] };
}

/**
 * Загружает профиль роли. Всегда читает sales.json (единственный конфиг),
 * id и title берёт из его targets по roleId.
 *
 * @param roleId - целевая роль
 * @param rolesConfigDir - директория конфигов ролей
 * @returns профиль роли
 */
export async function loadRoleProfile(roleId: GenerationRoleId, rolesConfigDir: string): Promise<RoleProfile> {
  const config = await loadRoleConfig(join(rolesConfigDir, "sales.json"));
  const target = config.targets.find((entry) => entry.id === roleId);

  if (target === undefined) {
    throw new Error(`Role not found: ${roleId}`);
  }

  return { id: target.id, title: target.title, skillsRules: config.skillsRules, atsKeywords: config.atsKeywords };
}
