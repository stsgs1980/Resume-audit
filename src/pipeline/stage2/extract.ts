import type { LlmClient } from "../../llm/client";
import { getPromptSpec } from "../../llm/prompt-registry";
import { loadPrompt } from "../../llm/prompts";
import type { ExtractionResponse } from "../../llm/schemas";
import type { FileEntry } from "../stage1/types";
import type { RawClaim } from "./types";

/**
 * Извлекает утверждения из одного текста через промт extraction.
 * Про чанкинг ничего не знает: один вызов — один текст.
 *
 * @param _file - запись файла из files.json (контекст вызывающей стороны)
 * @param text - очищенный текст файла
 * @param llmClient - LLM-клиент
 * @param promptConfig - конфиг загрузчика промтов
 * @param promptConfig.promptsDir - директория файлов промтов
 * @returns сырые утверждения или текст ошибки
 */
export async function extractClaimsFromFile(
  _file: FileEntry,
  text: string,
  llmClient: LlmClient,
  promptConfig: { promptsDir: string },
): Promise<{ claims: RawClaim[]; error: string | null }> {
  const promptText = await loadPrompt("extraction", 1, promptConfig);
  const spec = getPromptSpec<ExtractionResponse>("extraction");
  const result = await llmClient.call<ExtractionResponse>({
    system: spec.system,
    user: `${promptText}\n\n---\n\n${text}`,
    schema: spec.schema,
    stage: "extraction",
  });

  if (!result.ok) {
    return { claims: [], error: result.error.message };
  }

  return { claims: result.data.claims, error: null };
}
