import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { evidenceSchema } from "../../schemas/evidence";
import type { Facts } from "../../schemas/facts";

/**
 * Строит блок защиты одного результата.
 *
 * @param factId - id факта
 * @param text - формулировка результата
 * @param evidenceDir - директория карточек
 * @returns markdown-блок
 */
async function buildBlock(factId: string, text: string, evidenceDir: string): Promise<string> {
  let card: Record<string, string> | null = null;

  try {
    const parsed = JSON.parse(await readFile(join(evidenceDir, `${factId}.json`), "utf8")) as unknown;
    const validated = evidenceSchema.safeParse(parsed);

    if (validated.success) {
      card = validated.data as unknown as Record<string, string>;
    }
  } catch {
    card = null;
  }

  if (card === null) {
    return `## ${factId} — ${text}\n- Доказательства не заполнены`;
  }

  return [
    `## ${factId} — ${text}`,
    `- Определение метрики: ${card["metric_definition"] ?? ""}`,
    `- Формула: ${card["formula"] ?? ""}`,
    `- Период: ${card["period"] ?? ""}`,
    `- Базовая линия: ${card["baseline"] ?? ""}`,
    `- Источник данных: ${card["source_of_data"] ?? ""}`,
    `- Зона влияния: ${card["zone_of_influence"] ?? ""}`,
    `- Подтверждено: ${card["confirmed_by"] ?? ""}, ${card["confirmed_on"] ?? ""}`,
    `- Цитата: "${card["quote"] ?? ""}"`,
  ].join("\n");
}

/**
 * Собирает шпаргалку защиты цифр из facts и evidence.
 *
 * @param facts - факты из facts.json
 * @param evidenceDir - директория карточек
 * @returns markdown-документ
 */
export async function buildDefenseDocument(facts: Facts, evidenceDir: string): Promise<string> {
  const blocks: string[] = ["# Защита цифр на собеседовании", ""];

  for (const job of facts.jobs) {
    for (const result of job.results ?? []) {
      blocks.push(await buildBlock(result.evidence_id, result.text, evidenceDir), "");
    }
  }

  return blocks.join("\n");
}

/**
 * Атомарно пишет defense-документ (tmp + rename).
 *
 * @param content - markdown-документ
 * @param defensePath - целевой путь
 */
export async function writeDefenseDocument(content: string, defensePath: string): Promise<void> {
  const tmpPath = `${defensePath}.tmp.${process.pid}`;

  await mkdir(dirname(defensePath), { recursive: true });
  await writeFile(tmpPath, content, "utf8");
  await rename(tmpPath, defensePath);
}
