import { join } from "node:path";
import { writeJsonAtomic } from "../../server/storage/files";
import type { OpenQuestion } from "../stage3/types";
import type { EvidenceData, JobResult, Stage4Warning } from "./types";

/**
 * Ищет результат по связи с claim: совпадение source_claim_id
 * с одним из relatedClaimIds вопроса.
 *
 * @param results - результаты из facts.json
 * @param question - вопрос этапа 4
 * @returns найденный результат или undefined
 */
function findResultByClaim(results: JobResult[], question: OpenQuestion): JobResult | undefined {
  const wanted = new Set(question.relatedClaimIds);

  return results.find((result) => result.source_claim_id !== undefined && wanted.has(result.source_claim_id));
}

/**
 * Пишет карточку evidence в evidenceDir/<evidence_id>.json.
 * evidence_id берётся из результата, связанного с claim вопроса
 * через source_claim_id. Без связи — claim id как fallback с warning.
 *
 * @param question - вопрос этапа 4
 * @param data - данные карточки
 * @param results - результаты из facts.json (для связи claim -> result)
 * @param evidenceDir - директория карточек
 * @returns evidence_id карточки и предупреждения
 */
export async function writeEvidence(
  question: OpenQuestion,
  data: EvidenceData,
  results: JobResult[],
  evidenceDir: string,
): Promise<{ factId: string; warnings: Stage4Warning[] }> {
  const warnings: Stage4Warning[] = [];
  const linked = findResultByClaim(results, question);
  const factId = linked?.evidence_id ?? question.relatedClaimIds[0] ?? question.id;

  if (linked === undefined) {
    warnings.push({ code: "evidence_unlinked", message: `Связь claim -> result не найдена: ${question.id}` });
  }

  const today = new Date().toISOString().slice(0, 10);

  await writeJsonAtomic(join(evidenceDir, `${factId}.json`), {
    fact_id: factId,
    source_file: data.sourceFile,
    quote: data.quote,
    metric_definition: data.metricDefinition,
    formula: data.formula,
    period: data.period,
    baseline: data.baseline,
    source_of_data: data.sourceOfData,
    zone_of_influence: data.zoneOfInfluence,
    confirmed_by: "candidate",
    confirmed_on: today,
    status: "confirmed",
  });

  return { factId, warnings };
}
