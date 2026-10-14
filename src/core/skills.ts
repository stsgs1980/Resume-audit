/**
 * Per-role правила навыков: обобщённое ядро, конкретных ролей не знает.
 *
 * Пресет роли передаётся аргументом (см. config/roles/*.json).
 */

/** Правила навыков: always + списки для каждого roleId. */
export interface SkillsRules {
  always: string[];
  [roleId: string]: string[];
}

/** Целевая роль с долей. */
export interface RoleTarget {
  id: string;
  title: string;
  share: number;
}

/** Пресет роли: цели и правила навыков. */
export interface RolePreset {
  id: string;
  title: string;
  targets: RoleTarget[];
  skillsRules: SkillsRules;
}

/** Статус навыка для роли. */
export type SkillStatus = "confirmed" | "in_skills_only" | "not_found";

/** Итог проверки навыка для роли. */
export interface SkillCheckResult {
  skill: string;
  status: SkillStatus;
  inExperience: boolean;
  inSkillsField: boolean;
}

/**
 * Нормализует текст: строчные, ё->е, схлопывание пробелов, тримминг.
 *
 * @param text - исходный текст
 * @returns нормализованный текст
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

/**
 * Экранирует строку для вставки в regex.
 *
 * @param value - исходная строка
 * @returns строка с экранированными спецсимволами
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Ищет навык в тексте как отдельное слово.
 *
 * Границы — по не-буквам через (?<![а-яa-z0-9-]) / (?![а-яa-z0-9-]).
 * \b для кириллицы не работает. Дефис считается частью слова,
 * поэтому "SQL" не находится в "SQL-сервер".
 *
 * @param skill - искомый навык
 * @param text - текст опыта
 * @returns true, если навык найден как отдельное слово
 */
export function findSkillInText(skill: string, text: string): boolean {
  const normalizedSkill = normalizeText(skill);

  if (normalizedSkill === "") {
    return false;
  }

  const pattern = new RegExp(`(?<![а-яa-z0-9-])${escapeRegExp(normalizedSkill)}(?![а-яa-z0-9-])`);

  return pattern.test(normalizeText(text));
}

/**
 * Возвращает правила навыков для роли: always + правила roleId.
 *
 * Неизвестный roleId — только always. Дубликаты убираются.
 *
 * @param roleId - идентификатор роли из пресета
 * @param rules - правила навыков из пресета роли
 * @returns список навыков для роли
 */
export function getSkillRulesForRole(roleId: string, rules: SkillsRules): string[] {
  return [...new Set([...rules.always, ...(rules[roleId] ?? [])])];
}

/**
 * Проверяет навык для роли: подтверждение в опыте или только в поле навыков.
 *
 * Навык вне правил роли (нет в always и нет в rules[roleId]) не требуется
 * для роли: статус not_found, флаги присутствия при этом честные.
 *
 * @param skill - проверяемый навык
 * @param roleId - идентификатор роли из пресета
 * @param experienceText - текст опыта
 * @param skillsField - поле навыков из резюме
 * @param rules - правила навыков из пресета роли
 * @returns статус навыка и флаги присутствия
 */
export function checkSkillForRole(
  skill: string,
  roleId: string,
  experienceText: string,
  skillsField: string[],
  rules: SkillsRules,
): SkillCheckResult {
  const normalizedSkill = normalizeText(skill);
  const inExperience = findSkillInText(skill, experienceText);
  const inSkillsField = skillsField.some(
    (entry) => normalizeText(entry) === normalizedSkill || findSkillInText(skill, entry),
  );
  const required = getSkillRulesForRole(roleId, rules).some((entry) => normalizeText(entry) === normalizedSkill);

  if (!required) {
    return { skill, status: "not_found", inExperience, inSkillsField };
  }

  if (inExperience) {
    return { skill, status: "confirmed", inExperience, inSkillsField };
  }

  if (inSkillsField) {
    return { skill, status: "in_skills_only", inExperience, inSkillsField };
  }

  return { skill, status: "not_found", inExperience, inSkillsField };
}
