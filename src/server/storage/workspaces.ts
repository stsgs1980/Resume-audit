import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { WorkspaceExistsError } from "./errors";
import type { StorageConfig } from "./paths";
import { ensureWithinRoot, getEvidenceDir, getResumesDir, getWorkspaceDir, isValidSlug } from "./paths";

/**
 * Возвращает корень workspaces внутри rootDir.
 *
 * @param config - конфиг хранилища
 * @returns путь к <rootDir>/workspaces
 */
function getWorkspacesRoot(config: StorageConfig): string {
  return ensureWithinRoot(config.rootDir, join(config.rootDir, "workspaces"));
}

/**
 * Список slug всех workspace: только валидные имена папок.
 *
 * @param config - конфиг хранилища
 * @returns отсортированный список slug
 */
export async function listWorkspaces(config: StorageConfig): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(getWorkspacesRoot(config), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return entries
    .filter((entry) => entry.isDirectory() && isValidSlug(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Создаёт workspace с подпапками evidence/ и resumes/.
 *
 * @param config - конфиг хранилища
 * @param slug - slug нового workspace
 * @returns void
 * @throws WorkspaceExistsError если slug занят
 */
export async function createWorkspace(config: StorageConfig, slug: string): Promise<void> {
  if (await workspaceExists(config, slug)) {
    throw new WorkspaceExistsError(slug);
  }

  await mkdir(getWorkspaceDir(config, slug), { recursive: true });
  await mkdir(getEvidenceDir(config, slug), { recursive: true });
  await mkdir(getResumesDir(config, slug), { recursive: true });
}

/**
 * Удаляет workspace целиком. Корень workspaces/ не трогает.
 *
 * @param config - конфиг хранилища
 * @param slug - slug удаляемого workspace
 * @returns void
 */
export async function deleteWorkspace(config: StorageConfig, slug: string): Promise<void> {
  await rm(getWorkspaceDir(config, slug), { recursive: true, force: true });
}

/**
 * Проверяет существование workspace.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @returns true, если папка workspace существует
 */
export async function workspaceExists(config: StorageConfig, slug: string): Promise<boolean> {
  let workspaceDir: string;

  try {
    workspaceDir = getWorkspaceDir(config, slug);
  } catch {
    return false;
  }

  try {
    const info = await stat(workspaceDir);

    return info.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Проверяет существование пути (файл или папка).
 *
 * @param filePath - проверяемый путь
 * @returns true, если путь существует
 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);

    return true;
  } catch {
    return false;
  }
}
