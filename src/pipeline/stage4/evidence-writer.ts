import { join } from "node:path";
import { writeJsonAtomic } from "../../server/storage/files";
import type { OpenQuestion } from "../stage3/types";
import type { Claim, EvidenceData } from "./types";

/**
 * Пишет карточку evidence в evidenceDir/<fact_id>.json.
 * fact_id берётся из relatedClaimIds[0], fallback — questionId.
 *
 * @param question - вопрос этапа 4
 * @param data - данные карточки
 * @param claims - утверждения (для будущих проверок связности)
 * @param evidenceDir - директория карточек
 * @returns fact_id карточки
 */
export async function writeEvidence(
  question: OpenQuestion,
  data: EvidenceData,
  claims: Claim[],
  evidenceDir: string,
): Promise<string> {
  void claims;

  const factId = question.relatedClaimIds[0] ?? question.id;
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

  return factId;
}
