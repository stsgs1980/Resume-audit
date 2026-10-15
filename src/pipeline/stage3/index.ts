import { readFile } from "node:fs/promises";
import { writeJsonAtomic } from "../../server/storage/files";
import { detectDateContradictions, detectDurationMismatch, detectGaps } from "./date-check";
import { crossCheckClaims } from "./number-check";
import { detectParallelRoles, detectSkillConflicts } from "./overlap-check";
import { generateCurrencyQuestions, generateEvidenceQuestions, generateTargetVsMeasured } from "./question-generator";
import type { AuditWarning, Claim, Contradiction, OpenQuestion, Stage3aParams, Stage3aResult } from "./types";

/**
 * Загружает claims из файла (запасной источник при пустом входе).
 *
 * @param claimsPath - путь к claims.json
 * @returns утверждения или []
 */
async function loadClaimsFile(claimsPath: string): Promise<Claim[]> {
  try {
    const parsed = JSON.parse(await readFile(claimsPath, "utf8")) as { claims?: unknown };

    return Array.isArray(parsed.claims) ? (parsed.claims as Claim[]) : [];
  } catch {
    return [];
  }
}

/**
 * Запускает этап 3a: противоречия и открытые вопросы.
 * Исключения наружу не бросает: всё фиксируется в warnings.
 *
 * @param params - claims, пути, дата аудита и роли
 * @returns итог этапа
 */
export async function runStage3a(params: Stage3aParams): Promise<Stage3aResult> {
  const warnings: AuditWarning[] = [];
  let warnIndex = 1;

  const fail = (kind: string, message: string): void => {
    warnings.push({ id: `warn${warnIndex}`, kind, message });
    warnIndex += 1;
  };

  try {
    const claims = params.claims.length > 0 ? params.claims : await loadClaimsFile(params.claimsPath);

    const contradictions: Contradiction[] = [
      ...crossCheckClaims(claims),
      ...detectDateContradictions(claims),
      ...detectDurationMismatch(claims, params.auditDate),
      ...detectSkillConflicts(claims),
    ];

    const openQuestions: OpenQuestion[] = [
      ...detectGaps(claims),
      ...detectParallelRoles(claims),
      ...generateCurrencyQuestions(claims),
      ...generateEvidenceQuestions(claims),
      ...generateTargetVsMeasured(claims),
    ];

    contradictions.forEach((item, index) => {
      item.id = `contradiction${index + 1}`;
    });

    openQuestions.forEach((item, index) => {
      item.id = `q_${String(index + 1).padStart(3, "0")}`;
    });

    const result: Stage3aResult = {
      generatedAt: new Date().toISOString(),
      contradictions,
      openQuestions,
      warnings,
      counts: { contradictions: contradictions.length, openQuestions: openQuestions.length },
    };

    try {
      await writeJsonAtomic(params.auditPath, {
        facts_hash: "",
        meta_hash: "",
        generated_at: result.generatedAt,
        contradictions,
        open_questions: openQuestions,
        warnings: warnings.map((warning) => ({ ...warning, code: warning.kind })),
        roles: [],
        ats: {},
      });
    } catch (error) {
      fail("stage3_error", (error as Error).message);
    }

    return result;
  } catch (error) {
    fail("stage3_error", (error as Error).message);

    return {
      generatedAt: new Date().toISOString(),
      contradictions: [],
      openQuestions: [],
      warnings,
      counts: { contradictions: 0, openQuestions: 0 },
    };
  }
}
