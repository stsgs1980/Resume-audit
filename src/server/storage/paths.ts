import { resolve, sep } from "node:path";
import { PathTraversalError } from "./errors";

/** Конфигурация хранилища. */
export interface StorageConfig {
  /** Корень данных. */
  rootDir: string;
}

/** Допустимый slug: только [a-z0-9_-], длина 1..64. */
const SLUG_PATTERN = /^[a-z0-9_-]{1,64}$/;

/**
 * Проверяет slug без throw.
 *
 * @param slug - кандидат в slug
 * @returns true, если slug допустим
 */
export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/**
 * Создаёт конфиг хранилища.
 *
 * @param rootDir - корень данных; по умолчанию env RESUME_AUDIT_DATA_DIR или "data"
 * @returns конфиг хранилища
 */
export function createStorageConfig(rootDir?: string): StorageConfig {
  return { rootDir: rootDir ?? process.env["RESUME_AUDIT_DATA_DIR"] ?? "data" };
}

/**
 * Валидирует сегмент пути, throw при нарушении.
 *
 * @param segment - slug, factId или documentId
 * @returns тот же сегмент при успехе
 * @throws PathTraversalError при недопустимом сегменте
 */
function requireSafeSegment(segment: string): string {
  if (!isValidSlug(segment)) {
    throw new PathTraversalError(segment);
  }

  return segment;
}

/**
 * Проверяет, что целевой путь внутри корня.
 *
 * @param rootDir - корень хранилища
 * @param targetPath - проверяемый путь
 * @returns resolved путь при успехе
 * @throws PathTraversalError при выходе за пределы корня
 */
export function ensureWithinRoot(rootDir: string, targetPath: string): string {
  const root = resolve(rootDir);
  const target = resolve(targetPath);

  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new PathTraversalError(targetPath);
  }

  return target;
}

/**
 * Возвращает директорию workspace.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @returns <rootDir>/workspaces/<slug>
 * @throws PathTraversalError при невалидном slug
 */
export function getWorkspaceDir(config: StorageConfig, slug: string): string {
  requireSafeSegment(slug);

  return ensureWithinRoot(config.rootDir, resolve(config.rootDir, "workspaces", slug));
}

/**
 * Возвращает путь к facts.json.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @returns безопасный путь внутри workspace
 */
export function getFactsPath(config: StorageConfig, slug: string): string {
  return ensureWithinRoot(config.rootDir, resolve(getWorkspaceDir(config, slug), "facts.json"));
}

/**
 * Возвращает директорию карточек evidence.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @returns безопасный путь внутри workspace
 */
export function getEvidenceDir(config: StorageConfig, slug: string): string {
  return ensureWithinRoot(config.rootDir, resolve(getWorkspaceDir(config, slug), "evidence"));
}

/**
 * Возвращает путь к карточке evidence.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @param factId - id факта
 * @returns безопасный путь внутри workspace
 */
export function getEvidencePath(config: StorageConfig, slug: string, factId: string): string {
  requireSafeSegment(factId);

  return ensureWithinRoot(config.rootDir, resolve(getEvidenceDir(config, slug), `${factId}.json`));
}

/**
 * Возвращает путь к audit.json.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @returns безопасный путь внутри workspace
 */
export function getAuditPath(config: StorageConfig, slug: string): string {
  return ensureWithinRoot(config.rootDir, resolve(getWorkspaceDir(config, slug), "audit.json"));
}

/**
 * Возвращает путь к claims.json.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @returns безопасный путь внутри workspace
 */
export function getClaimsPath(config: StorageConfig, slug: string): string {
  return ensureWithinRoot(config.rootDir, resolve(getWorkspaceDir(config, slug), "claims.json"));
}

/**
 * Возвращает путь к validation.json.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @returns безопасный путь внутри workspace
 */
export function getValidationPath(config: StorageConfig, slug: string): string {
  return ensureWithinRoot(config.rootDir, resolve(getWorkspaceDir(config, slug), "validation.json"));
}

/**
 * Возвращает путь к stage-state.json.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @returns безопасный путь внутри workspace
 */
export function getStageStatePath(config: StorageConfig, slug: string): string {
  return ensureWithinRoot(config.rootDir, resolve(getWorkspaceDir(config, slug), "stage-state.json"));
}

/**
 * Возвращает директорию сгенерированных резюме.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @returns безопасный путь внутри workspace
 */
export function getResumesDir(config: StorageConfig, slug: string): string {
  return ensureWithinRoot(config.rootDir, resolve(getWorkspaceDir(config, slug), "resumes"));
}

/**
 * Возвращает путь к сгенерированному резюме.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @param documentId - id документа
 * @returns безопасный путь внутри workspace
 */
export function getResumePath(config: StorageConfig, slug: string, documentId: string): string {
  requireSafeSegment(documentId);

  return ensureWithinRoot(config.rootDir, resolve(getResumesDir(config, slug), `${documentId}.json`));
}

/**
 * Возвращает путь к lock-файлу фактов.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @returns безопасный путь внутри workspace
 */
export function getLockPath(config: StorageConfig, slug: string): string {
  return ensureWithinRoot(config.rootDir, resolve(getWorkspaceDir(config, slug), "facts.lock"));
}
