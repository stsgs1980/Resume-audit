import { readFile } from "node:fs/promises";
import { writeJsonAtomic } from "../../server/storage/files";
import { detectDateContradictions, detectDurationMismatch, detectGaps } from "./date-check";
import { crossCheckClaims } from "./number-check";
import { detectParallelRoles, detectSkillConflicts } from "./overlap-check";
import { generateCurrencyQuestions, generateEvidenceQuestions, generateTargetVsMeasured } from "./question-generator";
import { runStage3b } from "./stage3b";
import type {
  AuditResult,
  AuditWarning,
  Claim,
  Contradiction,
  OpenQuestion,
  Stage3aParams,
  Stage3aResult,
  Stage3Params,
} from "./types";

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

/**
 * Запускает этап 3 целиком: 3a, затем 3b, затем полный audit.json.
 * Исключения наружу не бросает.
 *
 * @param params - объединённые параметры 3a и 3b
 * @returns полный итог аудита
 */
export async function runStage3(params: Stage3Params): Promise<AuditResult> {
  const stage3a = await runStage3a(params);
  let stage3b: { roles: AuditResult["roles"]; ats: AuditResult["ats"]; warnings: AuditWarning[] };

  try {
    stage3b = await runStage3b(params);
  } catch (error) {
    stage3b = {
      roles: [],
      ats: null,
      warnings: [{ id: "warn0", kind: "stage3_error", message: (error as Error).message }],
    };
  }

  const warnings = [...stage3a.warnings, ...stage3b.warnings];
  const result: AuditResult = {
    facts_hash: "",
    meta_hash: "",
    generated_at: stage3a.generatedAt,
    contradictions: stage3a.contradictions,
    open_questions: stage3a.openQuestions,
    warnings,
    roles: stage3b.roles,
    ats: stage3b.ats,
  };

  try {
    await writeJsonAtomic(params.auditPath, {
      ...result,
      warnings: warnings.map((warning) => ({ ...warning, code: warning.kind })),
    });
  } catch (error) {
    warnings.push({
      id: `warn${warnings.length + 1}`,
      kind: "stage3_error",
      message: (error as Error).message,
    });
  }

  return { ...result, warnings };
}
