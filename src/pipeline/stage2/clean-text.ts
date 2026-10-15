/**
 * Очищает текст перед отправкой в LLM: разметка и мусор уходят,
 * содержимое резюме сохраняется.
 *
 * @param text - исходный текст
 * @returns очищенный текст
 */
export function cleanForLlm(text: string): string {
  return text
    .replace(/\uFEFF/g, "")
    .replace(/\s*(class|id)="[^"]*"/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}
