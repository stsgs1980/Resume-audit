import { findOverlaps } from "../../core/interval-analysis";
import { extractEmploymentIntervals } from "./date-check";
import type { Claim, Contradiction, OpenQuestion } from "./types";

/**
 * Ищет пересечения работ без overlap_group через findOverlaps.
 *
 * @param claims - утверждения этапа 2
 * @returns вопросы типа parallel_roles
 */
export function detectParallelRoles(claims: Claim[]): OpenQuestion[] {
  return findOverlaps(extractEmploymentIntervals(claims)).map((overlap) => ({
    id: "",
    type: "parallel_roles" as const,
    question: `Работы пересекаются на ${overlap.months} мес.: это параллельные роли?`,
    context: `${overlap.jobIdA} + ${overlap.jobIdB}`,
    relatedClaimIds: [overlap.jobIdA, overlap.jobIdB],
    createdFrom: "audit#overlap",
  }));
}

/**
 * Ищет один навык с противоречивыми статусами в разных claims.
 *
 * @param claims - утверждения этапа 2
 * @returns противоречия вида skill_conflict
 */
export function detectSkillConflicts(claims: Claim[]): Contradiction[] {
  const bySkill = new Map<string, Claim[]>();

  for (const claim of claims) {
    if (claim.category !== "skill") {
      continue;
    }

    const key = claim.statement.trim().toLowerCase();
    const group = bySkill.get(key) ?? [];

    group.push(claim);
    bySkill.set(key, group);
  }

  const contradictions: Contradiction[] = [];

  for (const group of bySkill.values()) {
    const statuses = new Set(group.map((claim) => claim.status));

    if (statuses.size < 2) {
      continue;
    }

    contradictions.push({
      id: "",
      kind: "skill_conflict",
      severity: "warning",
      factIds: group.map((claim) => claim.id),
      description: `Навык "${group[0]?.statement}" имеет разные статусы: ${[...statuses].join(", ")}`,
      evidence: group.map((claim) => claim.quote),
    });
  }

  return contradictions;
}
