import { auditSchema } from "../../schemas/audit";
import { claimsSchema } from "../../schemas/claims";
import type { Facts } from "../../schemas/facts";
import { factsSchema } from "../../schemas/facts";
import { readJson, writeJsonAtomic } from "../../server/storage/files";
import { hashFacts, hashMeta } from "../../server/storage/hash";
import { invalidateAllDocuments } from "../../server/storage/stage-state";
import { loadRoleConfig } from "../stage3/ats";
import { buildEducation, buildLanguages, buildProjects, buildSkills } from "./build-entities";
import { buildJobs, buildResults } from "./build-jobs";
import { buildMeta } from "./build-meta";
import type { Claim, Stage4aParams, Stage4aResult, Stage4Warning } from "./types";

/**
 * Читает утверждения из claims.json.
 *
 * @param claimsPath - путь к claims.json
 * @returns утверждения и текст ошибки чтения (null при успехе)
 */
async function loadClaims(claimsPath: string): Promise<{ claims: Claim[]; error: string | null }> {
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
 * Обновляет audit.json хешами записанных фактов.
 * audit.json отсутствует — тихо пропускается.
 *
 * @param auditPath - путь к audit.json
 * @param facts - записанные факты
 */
async function updateAuditHashes(auditPath: string, facts: Facts): Promise<void> {
  try {
    const audit = await readJson(auditPath, auditSchema);

    await writeJsonAtomic(auditPath, { ...audit, facts_hash: hashFacts(facts), meta_hash: hashMeta(facts) });
  } catch (error) {
    if ((error as Error).name !== "FileNotFoundError") {
      throw error;
    }
  }
}

/**
 * Пустой скелет фактов.
 *
 * @param params - параметры этапа
 * @param targets - цели из конфига роли
 * @returns факты без записей
 */
async function emptyFacts(
  params: Stage4aParams,
  targets: Array<{ id: string; title: string; share: number }>,
): Promise<Facts> {
  return {
    schema_version: 1,
    meta: buildMeta({
      candidateName: params.candidateName ?? "",
      auditDate: params.auditDate,
      geography: params.geography ?? "Москва",
      targets,
    }),
    jobs: [],
    education: [],
    languages: [],
    confirmed_skills: [],
    portfolio_projects: [],
  };
}

/**
 * Запускает этап 4a: claims.json -> скелет facts.json.
 * Исключения наружу не бросает: всё фиксируется в warnings.
 *
 * @param params - пути, конфиг роли, дата, география, имя
 * @returns итог этапа
 */
export async function runStage4a(params: Stage4aParams): Promise<Stage4aResult> {
  const warnings: Stage4Warning[] = [];

  try {
    const loaded = await loadClaims(params.claimsPath);

    if (loaded.error !== null) {
      warnings.push({ code: "claims_unreadable", message: loaded.error });
    }

    const claims = loaded.claims;
    const roleConfig = await loadRoleConfig(params.rolesConfigPath);
    const roles = roleConfig.targets.map((target) => target.id);

    if (claims.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        facts: await emptyFacts(params, roleConfig.targets),
        written: false,
        warnings,
      };
    }

    const builtJobs = buildJobs(claims, roles);

    warnings.push(...builtJobs.warnings);

    const withResults = buildResults(claims, builtJobs.jobs, roles);

    warnings.push(...withResults.warnings);

    const facts: Facts = {
      schema_version: 1,
      meta: buildMeta({
        candidateName: params.candidateName ?? "",
        auditDate: params.auditDate,
        geography: params.geography ?? "Москва",
        targets: roleConfig.targets,
      }),
      jobs: withResults.jobs,
      education: buildEducation(claims),
      languages: buildLanguages(claims),
      confirmed_skills: buildSkills(claims, roles),
      portfolio_projects: buildProjects(claims, roles),
    };
    const validated = factsSchema.safeParse(facts);

    if (!validated.success) {
      warnings.push({
        code: "schema_mismatch",
        message: `facts.json не прошёл схему: ${JSON.stringify(validated.error.issues)}`,
      });

      return { generatedAt: new Date().toISOString(), facts, written: false, warnings };
    }

    try {
      await writeJsonAtomic(params.factsPath, validated.data);
    } catch (error) {
      warnings.push({ code: "write_failed", message: (error as Error).message });

      return { generatedAt: new Date().toISOString(), facts, written: false, warnings };
    }

    try {
      await updateAuditHashes(params.auditPath, validated.data);
    } catch (error) {
      warnings.push({ code: "audit_update_failed", message: (error as Error).message });
    }

    if (params.storageConfig !== undefined && params.slug !== undefined) {
      try {
        await invalidateAllDocuments(params.storageConfig, params.slug, hashFacts(validated.data));
      } catch (error) {
        warnings.push({ code: "invalidate_failed", message: (error as Error).message });
      }
    }

    return { generatedAt: new Date().toISOString(), facts, written: true, warnings };
  } catch (error) {
    warnings.push({ code: "stage4_error", message: (error as Error).message });

    return {
      generatedAt: new Date().toISOString(),
      facts: await emptyFacts(params, []),
      written: false,
      warnings,
    };
  }
}
