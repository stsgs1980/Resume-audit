import type { Currency, NumberQualifier, ParsedNumber } from "../../core/numbers";
import { crossCheckNumbers } from "../../core/numbers";
import type { Claim, Contradiction } from "./types";

/**
 * Нормализует число claim в ParsedNumber для кросс-проверки.
 *
 * @param claim - утверждение с числом
 * @returns нормализованное число
 */
function toParsedNumber(claim: Claim): ParsedNumber {
  const text = `${claim.statement} ${claim.quote}`;
  const approx = text.includes("~") || text.toLowerCase().includes("около");
  const percent = claim.metric_type === "процент" || text.includes("%");
  let qualifier: NumberQualifier = "exact";

  if (approx && percent) {
    qualifier = "approx-percent";
  } else if (approx) {
    qualifier = "approx";
  } else if (percent) {
    qualifier = "percent";
  }

  return { value: claim.number as number, currency: claim.currency as Currency | null, qualifier };
}

/**
 * Сравнивает числа внутри групп по metric_type. Одна группа — одно противоречие.
 *
 * @param claims - утверждения этапа 2
 * @returns противоречия вида number_mismatch
 */
export function crossCheckClaims(claims: Claim[]): Contradiction[] {
  const groups = new Map<string, Claim[]>();

  for (const claim of claims) {
    if (claim.number === null) {
      continue;
    }

    const group = groups.get(claim.metric_type) ?? [];

    group.push(claim);
    groups.set(claim.metric_type, group);
  }

  const contradictions: Contradiction[] = [];

  for (const [metric, group] of groups) {
    if (group.length < 2) {
      continue;
    }

    let hard: { first: Claim; second: Claim; reason: string } | null = null;
    let soft: { first: Claim; second: Claim; reason: string } | null = null;

    for (let index = 0; index < group.length; index += 1) {
      for (let other = index + 1; other < group.length; other += 1) {
        const first = group[index] as Claim;
        const second = group[other] as Claim;
        const checked = crossCheckNumbers(toParsedNumber(first), toParsedNumber(second));

        if (checked.severity === "hard") {
          hard = { first, second, reason: checked.reason };
        } else if (checked.severity === "warning" && checked.reason.includes("округление")) {
          soft = soft ?? { first, second, reason: checked.reason };
        }
      }
    }

    const hit = hard ?? soft;

    if (hit === null) {
      continue;
    }

    contradictions.push({
      id: "",
      kind: "number_mismatch",
      severity: hard === null ? "warning" : "hard",
      factIds: [hit.first.id, hit.second.id],
      description: `Метрика "${metric}": ${hit.first.number} против ${hit.second.number} — ${hit.reason}`,
      evidence: [hit.first.quote, hit.second.quote],
    });
  }

  return contradictions;
}
