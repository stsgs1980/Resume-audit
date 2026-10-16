import { getPromptSpec } from "../../llm/prompt-registry";
import { loadPrompt } from "../../llm/prompts";
import type { ResumeResponse } from "../../llm/schemas";
import type { Facts } from "../../schemas/facts";
import { hashFacts } from "../../server/storage/hash";
import { buildLlmInput } from "./build-input";
import { loadRoleProfile } from "./load-profile";
import type { GeneratedResume, GenerationRoleId, Stage7Params } from "./types";

/** Id промта генерации для каждой роли. */
const PROMPT_IDS: Record<GenerationRoleId, string> = {
  sales: "generation_sales",
  salesops: "generation_salesops",
  aipo: "generation_aipo",
};

/**
 * Генерирует одну версию резюме через LLM.
 *
 * @param facts - факты из facts.json
 * @param roleId - целевая роль
 * @param params - параметры этапа
 * @returns резюме или текст ошибки
 */
export async function generateForRole(
  facts: Facts,
  roleId: GenerationRoleId,
  params: Stage7Params,
): Promise<{ resume: GeneratedResume | null; error: string | null }> {
  try {
    const profile = await loadRoleProfile(roleId, params.rolesConfigDir);
    const promptId = PROMPT_IDS[roleId];
    const spec = getPromptSpec<ResumeResponse>(promptId);
    const promptText = await loadPrompt(promptId, 1, params.promptConfig);
    const result = await params.llmClient.call({
      system: spec.system,
      user: `${promptText}\n\n${buildLlmInput(facts, profile, roleId)}`,
      schema: spec.schema,
      stage: `generation_${roleId}`,
    });

    if (!result.ok) {
      return { resume: null, error: result.error.message };
    }

    return {
      resume: {
        versionId: `hh_v1_${roleId}`,
        roleId,
        generatedAt: new Date().toISOString(),
        factsHash: hashFacts(facts),
        promptVersion: `generation.${roleId}.v1`,
        modelId: params.modelId,
        document: result.data,
      },
      error: null,
    };
  } catch (error) {
    return { resume: null, error: (error as Error).message };
  }
}
