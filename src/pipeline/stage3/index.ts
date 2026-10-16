import { auditSchema } from "../../schemas/audit";
import { claimsSchema } from "../../schemas/claims";
import { factsSchema } from "../../schemas/facts";
import { readJson, writeJsonAtomic } from "../../server/storage/files";
import { hashFacts, hashMeta } from "../../server/storage/hash";
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
 * @returns утверждения и текст ошибки чтения (null при успехе)
 */
async function loadClaimsFile(claimsPath: string): Promise<{ claims: Claim[]; error: string | null }> {
  try {
    const parsed = await readJson(claimsPath, claimsSchema);

    return { claims: parsed.claims, error: null };
  } catch (error) {
    if ((error as Error).name === "FileNotFoundError") {
      return { claims: [], error: null };
    }

    return { claims: [], error: (error as Error).message };
  }
}

/**
 * Считает хеши facts.json для audit.json.
 * Файла нет — пустые хеши и предупреждение.
 *
 * @param factsPath - путь к facts.json (опционально)
 * @returns хеши и текст предупреждения (null, если всё посчитано)
 */
async function resolveAuditHashes(
  factsPath: string | undefined,
): Promise<{ factsHash: string; metaHash: string; warning: string | null }> {
  const emptyWarning = "audit создан до facts.json, hash будет заполнен при пересчёте";

  if (factsPath === undefined) {
    return { factsHash: "", metaHash: "", warning: emptyWarning };
  }

  try {
    const facts = await readJson(factsPath, factsSchema);

    return { factsHash: hashFacts(facts), metaHash: hashMeta(facts), warning: null };
  } catch (error) {
    if ((error as Error).name === "FileNotFoundError") {
      return { factsHash: "", metaHash: "", warning: emptyWarning };
    }

    return { factsHash: "", metaHash: "", warning: `facts.json не прочитан: ${(error as Error).message}` };
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
    const loaded =
      params.claims.length > 0 ? { claims: params.claims, error: null } : await loadClaimsFile(params.claimsPath);

    if (loaded.error !== null) {
      fail("claims_unreadable", loaded.error);
    }

    const claims = loaded.claims;
    const hashes = await resolveAuditHashes(params.factsPath);

    if (hashes.warning !== null) {
      fail("audit_before_facts", hashes.warning);
    }

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
      factsHash: hashes.factsHash,
      metaHash: hashes.metaHash,
    };

    const audit = auditSchema.safeParse({
      facts_hash: hashes.factsHash,
      meta_hash: hashes.metaHash,
      generated_at: result.generatedAt,
      contradictions,
      open_questions: openQuestions,
      warnings: warnings.map((warning) => ({ ...warning, code: warning.kind })),
      roles: [],
      ats: {},
    });

    if (!audit.success) {
      fail("audit_schema_mismatch", JSON.stringify(audit.error.issues));
    } else {
      try {
        await writeJsonAtomic(params.auditPath, audit.data);
      } catch (error) {
        fail("stage3_error", (error as Error).message);
      }
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
      factsHash: "",
      metaHash: "",
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
    facts_hash: stage3a.factsHash,
    meta_hash: stage3a.metaHash,
    generated_at: stage3a.generatedAt,
    contradictions: stage3a.contradictions,
    open_questions: stage3a.openQuestions,
    warnings,
    roles: stage3b.roles,
    ats: stage3b.ats,
  };

  const audit = auditSchema.safeParse({
    ...result,
    warnings: warnings.map((warning) => ({ ...warning, code: warning.kind })),
  });

  if (!audit.success) {
    warnings.push({
      id: `warn${warnings.length + 1}`,
      kind: "audit_schema_mismatch",
      message: JSON.stringify(audit.error.issues),
    });
  } else {
    try {
      await writeJsonAtomic(params.auditPath, audit.data);
    } catch (error) {
      warnings.push({
        id: `warn${warnings.length + 1}`,
        kind: "stage3_error",
        message: (error as Error).message,
      });
    }
  }

  return { ...result, warnings };
}
