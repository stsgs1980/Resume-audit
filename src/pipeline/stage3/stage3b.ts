import { analyzeAts, loadRoleConfig } from "./ats";
import { assessRoles } from "./roles";
import type { RoleAssessment, Stage3bParams, Stage3bResult } from "./types";

/**
 * Запускает этап 3b: оценки ролей через LLM и ATS-анализ.
 * Ошибки не бросает: всё фиксируется в errors.
 *
 * @param params - claims, конфиг роли, клиент, промты, вакансия, роль
 * @returns итог этапа
 */
export async function runStage3b(params: Stage3bParams): Promise<Stage3bResult> {
  const errors: Array<{ source: string; reason: string }> = [];
  const roleId = params.targetRoleId ?? "sales";
  let assessments: RoleAssessment[] = [];

  try {
    const assessed = await assessRoles(params.claims, params.llmClient, params.promptConfig, roleId);

    assessments = assessed.assessments;

    if (assessed.error !== null) {
      errors.push({ source: "roles", reason: assessed.error });
    }
  } catch (error) {
    errors.push({ source: "roles", reason: (error as Error).message });
  }

  try {
    const roleConfig = await loadRoleConfig(params.rolesConfigPath);
    const ats = analyzeAts(params.claims, roleConfig, roleId, params.vacancyText);

    return {
      generatedAt: new Date().toISOString(),
      roles: assessments,
      ats,
      warnings: [],
      errors,
    };
  } catch (error) {
    errors.push({ source: "ats", reason: (error as Error).message });

    return { generatedAt: new Date().toISOString(), roles: assessments, ats: null, warnings: [], errors };
  }
}
