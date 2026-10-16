import type { LlmClient } from "../../llm/client";
import { getPromptSpec } from "../../llm/prompt-registry";
import { loadPrompt } from "../../llm/prompts";
import type { RolesResponse } from "../../llm/schemas";
import type { Claim, RoleAssessment } from "./types";

/**
 * Строит компактную сводку claims для промта (без лишних полей).
 *
 * @param claims - утверждения этапа 2
 * @returns текст сводки
 */
function summarizeClaims(claims: Claim[]): string {
  return claims
    .map((claim) => {
      const number = claim.number === null ? "-" : `${claim.number} ${claim.currency ?? ""}`.trim();

      return `- ${claim.statement} | ${number} | ${claim.quote}`;
    })
    .join("\n");
}

/**
 * Маппинг snake_case ответа LLM в camelCase RoleAssessment.
 *
 * @param response - ответ по rolesResponseSchema
 * @returns оценки ролей
 */
export function transformRoleResponse(response: RolesResponse): RoleAssessment[] {
  return response.roles.map((role) => ({
    roleId: role.role_id,
    scores: role.scores,
    total: role.total,
    strengths: role.strengths,
    gaps: role.gaps,
    overpositioningRisk: role.overpositioning_risk,
    recommendation: role.recommendation,
  }));
}

/**
 * Оценивает роли через промт roles.
 *
 * @param claims - утверждения этапа 2
 * @param llmClient - LLM-клиент
 * @param promptConfig - конфиг загрузчика промтов
 * @param promptConfig.promptsDir - директория файлов промтов
 * @param roleId - целевая роль (для контекста)
 * @returns оценки или текст ошибки
 */
export async function assessRoles(
  claims: Claim[],
  llmClient: LlmClient,
  promptConfig: { promptsDir: string },
  roleId: string,
): Promise<{ assessments: RoleAssessment[]; error: string | null }> {
  const promptText = await loadPrompt("roles", 1, promptConfig);
  const spec = getPromptSpec<RolesResponse>("roles");
  const result = await llmClient.call({
    system: spec.system,
    user: `${promptText}\n\nРоль: ${roleId}\n\n---\n\n${summarizeClaims(claims)}`,
    schema: spec.schema,
    stage: "roles",
  });

  if (!result.ok) {
    return { assessments: [], error: result.error.message };
  }

  return { assessments: transformRoleResponse(result.data), error: null };
}
