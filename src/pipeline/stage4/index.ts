import { claimsSchema } from "../../schemas/claims";
import type { Facts } from "../../schemas/facts";
import { fileExists, readJson } from "../../server/storage/files";
import { loadRoleConfig } from "../stage3/ats";
import { buildEducation, buildLanguages, buildProjects, buildSkills } from "./build-entities";
import { buildJobs, buildResults } from "./build-jobs";
import { buildMeta } from "./build-meta";
import { readFacts } from "./facts-lock";
import { persistFacts } from "./persist";
import type { Claim, Stage4aParams, Stage4aResult, Stage4Warning } from "./types";

/** Итог чтения claims.json. */
interface LoadedClaims {
  /** Утверждения. */
  claims: Claim[];
  /** Ошибка чтения или null. */
  error: string | null;
  /** Файл существует. */
  found: boolean;
}

/**
 * Читает утверждения из claims.json.
 *
 * @param claimsPath - путь к claims.json
 * @returns утверждения, ошибка чтения и признак наличия файла
 */
async function loadClaims(claimsPath: string): Promise<LoadedClaims> {
  try {
    const parsed = await readJson(claimsPath, claimsSchema);

    return { claims: parsed.claims, error: null, found: true };
  } catch (error) {
    if ((error as Error).name === "FileNotFoundError") {
      return { claims: [], error: null, found: false };
    }

    return { claims: [], error: (error as Error).message, found: false };
  }
}

/**
 * Собирает meta, сохраняя имя и географию из существующих фактов.
 *
 * @param params - параметры этапа
 * @param targets - цели из конфига роли
 * @param existing - существующие факты или null
 * @returns meta для facts.json
 */
function buildStageMeta(
  params: Stage4aParams,
  targets: Array<{ id: string; title: string; share: number }>,
  existing: Facts | null,
): Facts["meta"] {
  return buildMeta({
    candidateName: params.candidateName ?? existing?.meta.candidate_name ?? "",
    auditDate: params.auditDate,
    geography: params.geography ?? existing?.meta.geography ?? "Москва",
    targets,
  });
}

/**
 * Пустой скелет фактов.
 *
 * @param params - параметры этапа
 * @param targets - цели из конфига роли
 * @param existing - существующие факты или null
 * @returns факты без записей
 */
async function emptyFacts(
  params: Stage4aParams,
  targets: Array<{ id: string; title: string; share: number }>,
  existing: Facts | null,
): Promise<Facts> {
  return {
    schema_version: 1,
    meta: buildStageMeta(params, targets, existing),
    jobs: [],
    education: [],
    languages: [],
    confirmed_skills: [],
    portfolio_projects: [],
  };
}

/**
 * Собирает факты из утверждений и конфига ролей.
 *
 * @param params - параметры этапа
 * @param claims - утверждения
 * @param targets - цели из конфига роли
 * @param existing - существующие факты или null
 * @param warnings - накопитель предупреждений
 * @returns факты
 */
function assembleFacts(
  params: Stage4aParams,
  claims: Claim[],
  targets: Array<{ id: string; title: string; share: number }>,
  existing: Facts | null,
  warnings: Stage4Warning[],
): Facts {
  const roles = targets.map((target) => target.id);
  const builtJobs = buildJobs(claims, roles);

  warnings.push(...builtJobs.warnings);

  const withResults = buildResults(claims, builtJobs.jobs, roles);

  warnings.push(...withResults.warnings);

  return {
    schema_version: 1,
    meta: buildStageMeta(params, targets, existing),
    jobs: withResults.jobs,
    education: buildEducation(claims),
    languages: buildLanguages(claims),
    confirmed_skills: buildSkills(claims, roles),
    portfolio_projects: buildProjects(claims, roles),
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
  const generatedAt = new Date().toISOString();

  try {
    const loaded = await loadClaims(params.claimsPath);
    const roleConfig = await loadRoleConfig(params.rolesConfigPath);
    const existing = await readFacts(params.factsPath);

    if (loaded.error !== null) {
      warnings.push({ code: "claims_unreadable", message: loaded.error });

      return {
        generatedAt,
        facts: await emptyFacts(params, roleConfig.targets, existing),
        written: false,
        warnings,
      };
    }

    if (!loaded.found) {
      warnings.push({ code: "claims_missing", message: "claims.json не найден" });
    } else if (loaded.claims.length === 0) {
      warnings.push({ code: "claims_empty", message: "claims.json не содержит утверждений" });
    }

    if ((!loaded.found || loaded.claims.length === 0) && (await fileExists(params.factsPath))) {
      return {
        generatedAt,
        facts: await emptyFacts(params, roleConfig.targets, existing),
        written: false,
        warnings,
      };
    }

    return await persistFacts(
      params,
      assembleFacts(params, loaded.claims, roleConfig.targets, existing, warnings),
      warnings,
    );
  } catch (error) {
    warnings.push({ code: "stage4_error", message: (error as Error).message });

    return {
      generatedAt,
      facts: await emptyFacts(params, [], null),
      written: false,
      warnings,
    };
  }
}
