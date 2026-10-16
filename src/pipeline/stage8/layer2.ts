import type { LlmClient } from "../../llm/client";
import { getPromptSpec } from "../../llm/prompt-registry";
import { loadPrompt } from "../../llm/prompts";
import type { ResumeResponse, VerificationResponse } from "../../llm/schemas";
import type { Facts } from "../../schemas/facts";
import type { ValidationLayer2 } from "./types";

/**
 * Слой 2: сверка версии с фактами через LLM.
 * Ошибки не бросает, возвращает текст ошибки.
 *
 * @param resume - документ резюме
 * @param facts - факты из facts.json
 * @param roleId - целевая роль
 * @param llmClient - LLM-клиент
 * @param promptConfig - конфиг загрузчика промтов
 * @param promptConfig.promptsDir - директория файлов промтов
 * @returns слой 2 или текст ошибки
 */
export async function verifyLayer2(
  resume: ResumeResponse,
  facts: Facts,
  roleId: string,
  llmClient: LlmClient,
  promptConfig: { promptsDir: string },
): Promise<{ layer2: ValidationLayer2 | null; error: string | null }> {
  try {
    const spec = getPromptSpec<VerificationResponse>("verification");
    const promptText = await loadPrompt("verification", 1, promptConfig);
    const input = `RESUME:\n${JSON.stringify(resume)}\n\nFACTS:\n${JSON.stringify(facts)}\n\nROLE:\n${roleId}`;
    const result = await llmClient.call({
      system: spec.system,
      user: `${promptText}\n\n${input}`,
      schema: spec.schema,
      stage: "verification",
    });

    if (!result.ok) {
      return { layer2: null, error: result.error.message };
    }

    return {
      layer2: {
        checks: result.data.checks.map((check) => ({
          number: check.number,
          claim: check.claim,
          matchesFact: check.matches_fact,
          factId: check.fact_id,
          matchesRole: check.matches_role,
          hasHedge: check.has_hedge,
          verdict: check.verdict,
          comment: check.comment,
        })),
        unsupportedSkills: result.data.unsupported_skills,
        forbiddenWordsFound: result.data.forbidden_words_found,
      },
      error: null,
    };
  } catch (error) {
    return { layer2: null, error: (error as Error).message };
  }
}
