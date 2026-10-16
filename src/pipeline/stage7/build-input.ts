import type { Facts } from "../../schemas/facts";
import type { RoleProfile } from "./load-profile";
import type { GenerationRoleId } from "./types";

/**
 * Строит вход LLM: компактный facts + профиль роли. Без claims и черновиков.
 *
 * @param facts - факты из facts.json
 * @param roleProfile - профиль роли
 * @param roleId - целевая роль
 * @returns текст user-части промта
 */
export function buildLlmInput(facts: Facts, roleProfile: RoleProfile, roleId: GenerationRoleId): string {
  void roleId;

  const factsJson = JSON.stringify(facts);
  const profileJson = JSON.stringify({ title: roleProfile.title, skillsRules: roleProfile.skillsRules });

  return `FACTS:\n${factsJson}\n\nROLE PROFILE:\n${profileJson}`;
}
