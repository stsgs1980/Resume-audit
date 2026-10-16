import type { Claim, Facts } from "./types";

/** Образование из facts.json. */
type Education = Facts["education"][number];

/** Язык из facts.json. */
type Language = Facts["languages"][number];

/** Навык из facts.json. */
type ConfirmedSkill = Facts["confirmed_skills"][number];

/** Проект из facts.json. */
type PortfolioProject = Facts["portfolio_projects"][number];

/**
 * Строит образование из education-утверждений.
 *
 * @param claims - утверждения этапа 2
 * @returns записи edu1, edu2, ...
 */
export function buildEducation(claims: Claim[]): Education[] {
  return claims
    .filter((claim) => claim.category === "education")
    .map((claim, index) => ({ id: `edu${index + 1}`, institution: claim.statement }));
}

/**
 * Делит формулировку на название и уровень ("Английский — B2").
 *
 * @param statement - формулировка утверждения
 * @returns название и уровень (уровень может отсутствовать)
 */
function splitLevel(statement: string): { name: string; level?: string } {
  const match = /^(.+?)\s*[—\-:]\s*(.+)$/u.exec(statement.trim());

  if (match?.[1] !== undefined && match[2] !== undefined && match[2].trim() !== "") {
    return { name: match[1].trim(), level: match[2].trim() };
  }

  return { name: statement.trim() };
}

/**
 * Строит языки из language-утверждений.
 *
 * @param claims - утверждения этапа 2
 * @returns записи lang1, lang2, ...
 */
export function buildLanguages(claims: Claim[]): Language[] {
  return claims
    .filter((claim) => claim.category === "language")
    .map((claim, index) => {
      const { name, level } = splitLevel(claim.statement);

      return level === undefined ? { id: `lang${index + 1}`, name } : { id: `lang${index + 1}`, name, level };
    });
}

/**
 * Строит навыки из skill-утверждений со статусом confirmed.
 *
 * @param claims - утверждения этапа 2
 * @param roles - целевые роли (по умолчанию [])
 * @returns записи sk1, sk2, ...
 */
export function buildSkills(claims: Claim[], roles: string[] = []): ConfirmedSkill[] {
  return claims
    .filter((claim) => claim.category === "skill" && claim.status === "confirmed")
    .map((claim, index) => ({ id: `sk${index + 1}`, skill: claim.statement, roles: [...roles] }));
}

/**
 * Строит проекты из project-утверждений.
 *
 * @param claims - утверждения этапа 2
 * @param roles - целевые роли (по умолчанию [])
 * @returns записи proj1, proj2, ...
 */
export function buildProjects(claims: Claim[], roles: string[] = []): PortfolioProject[] {
  return claims
    .filter((claim) => claim.category === "project")
    .map((claim, index) => ({ id: `proj${index + 1}`, title: claim.statement, roles: [...roles] }));
}
