import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { SkillsRules } from "../../core/skills";
import { checkSkillForRole, getSkillRulesForRole } from "../../core/skills";
import type { AtsAnalysis, AtsKeyword, Claim } from "./types";

const roleConfigSchema = z.object({
  id: z.string(),
  title: z.string(),
  targets: z.array(z.object({ id: z.string(), title: z.string(), share: z.number() })),
  skillsRules: z.object({ always: z.array(z.string()) }).catchall(z.array(z.string())),
  atsKeywords: z.object({ mandatory: z.array(z.string()), optional: z.array(z.string()) }).optional(),
});

/** Конфиг роли с ATS-ключами. */
export type RoleConfig = z.infer<typeof roleConfigSchema>;

/**
 * Читает и валидирует конфиг роли.
 *
 * @param rolesConfigPath - путь к config/roles/*.json
 * @returns конфиг роли
 */
export async function loadRoleConfig(rolesConfigPath: string): Promise<RoleConfig> {
  const parsed = JSON.parse(await readFile(rolesConfigPath, "utf8")) as unknown;

  return roleConfigSchema.parse(parsed);
}

/**
 * Извлекает слова-кандидаты из вакансии: длина 3+, встречаемость 2+.
 *
 * @param vacancyText - текст вакансии
 * @returns уникальные слова
 */
function extractVacancyKeywords(vacancyText: string): string[] {
  const counts = new Map<string, number>();

  for (const word of vacancyText.toLowerCase().match(/[a-zа-яё0-9]+/g) ?? []) {
    if (word.length >= 3) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return [...counts.entries()].filter(([, count]) => count >= 2).map(([word]) => word);
}

/**
 * Детерминированный ATS-анализ: ключи ищутся в claims через ядро.
 *
 * @param claims - утверждения этапа 2
 * @param roleConfig - конфиг роли
 * @param roleId - целевая роль
 * @param vacancyText - текст вакансии или null
 * @returns анализ ATS
 */
export function analyzeAts(
  claims: Claim[],
  roleConfig: RoleConfig,
  roleId: string,
  vacancyText: string | null,
): AtsAnalysis {
  const mandatory = roleConfig.atsKeywords?.mandatory ?? [];
  const configured = [...mandatory, ...(roleConfig.atsKeywords?.optional ?? [])];
  const vacancyKeywords = vacancyText === null ? [] : extractVacancyKeywords(vacancyText);
  const keywords = [...new Set([...configured, ...vacancyKeywords])];
  const fallbackRules: SkillsRules = {
    always: getSkillRulesForRole(roleId, roleConfig.skillsRules),
    [roleId]: [],
  };
  const experienceText = claims
    .filter((claim) => claim.category === "result" || claim.category === "employment")
    .map((claim) => `${claim.statement} ${claim.quote}`)
    .join("\n");
  const skillsField = claims.filter((claim) => claim.category === "skill").map((claim) => claim.statement);

  const analyzed: AtsKeyword[] = keywords.map((keyword) => {
    const checked = checkSkillForRole(keyword, roleId, experienceText, skillsField, fallbackRules);
    const category: AtsKeyword["category"] = checked.inExperience
      ? "in_experience"
      : checked.inSkillsField
        ? "in_skills_only"
        : "absent";

    return {
      keyword,
      category,
      isMandatory: mandatory.includes(keyword) || vacancyKeywords.includes(keyword),
    };
  });

  return {
    roleId,
    hasVacancy: vacancyText !== null,
    keywords: analyzed,
    mandatoryMissing: analyzed
      .filter((entry) => entry.isMandatory && entry.category === "absent")
      .map((entry) => entry.keyword),
    recommendedSkillsOrder: analyzed.slice(0, 15).map((entry) => entry.keyword),
  };
}
