import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Claim, OpenQuestion } from "./types";

/**
 * Загружает маркеры прогноза из config/forecast-markers.json.
 *
 * @returns маркеры в нижнем регистре
 */
function loadForecastMarkers(): string[] {
  try {
    const parsed = JSON.parse(readFileSync(join(process.cwd(), "config", "forecast-markers.json"), "utf8")) as {
      markers?: unknown;
    };

    if (!Array.isArray(parsed.markers)) {
      return [];
    }

    return parsed.markers.filter((marker): marker is string => typeof marker === "string");
  } catch {
    return [];
  }
}

const forecastMarkers = loadForecastMarkers();

/**
 * Утверждения с числом, но без валюты.
 *
 * @param claims - утверждения этапа 2
 * @returns вопросы типа currency_missing
 */
export function generateCurrencyQuestions(claims: Claim[]): OpenQuestion[] {
  return claims
    .filter((claim) => claim.number !== null && claim.currency === null)
    .map((claim) => ({
      id: "",
      type: "currency_missing" as const,
      question: `Валюта не указана в утверждении: ${claim.statement}`,
      context: claim.source_file,
      relatedClaimIds: [claim.id],
      createdFrom: "audit#currency_missing",
    }));
}

/**
 * Утверждения, требующие доказательств.
 *
 * @param claims - утверждения этапа 2
 * @returns вопросы типа missing_evidence
 */
export function generateEvidenceQuestions(claims: Claim[]): OpenQuestion[] {
  return claims
    .filter((claim) => claim.status === "needs_evidence")
    .map((claim) => ({
      id: "",
      type: "missing_evidence" as const,
      question: `Требуется подтверждение: ${claim.statement}`,
      context: claim.source_file,
      relatedClaimIds: [claim.id],
      createdFrom: "audit#missing_evidence",
    }));
}

/**
 * Числа рядом с маркерами прогноза — возможно целевые метрики.
 *
 * @param claims - утверждения этапа 2
 * @returns вопросы типа target_vs_measured
 */
export function generateTargetVsMeasured(claims: Claim[]): OpenQuestion[] {
  const lower = (text: string) => text.toLowerCase();

  return claims
    .filter(
      (claim) =>
        claim.number !== null &&
        forecastMarkers.some((marker) => lower(`${claim.statement} ${claim.quote}`).includes(marker)),
    )
    .map((claim) => ({
      id: "",
      type: "target_vs_measured" as const,
      question: `Прогноз или измеренный результат: ${claim.statement}`,
      context: claim.source_file,
      relatedClaimIds: [claim.id],
      createdFrom: "audit#target_vs_measured",
    }));
}
