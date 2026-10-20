import { readdir } from "node:fs/promises";
import { basename } from "node:path";

/** Итог выбора версий для проверки. */
export interface SelectedVersions {
  /** Имена файлов резюме. */
  files: string[];
  /** Ошибки: запрошенные, но отсутствующие версии или сбой чтения. */
  errors: Array<{ versionId: string; reason: string }>;
}

/**
 * Выбирает версии для проверки: все файлы или только запрошенные.
 * Отсутствие запрошенной версии — ошибка, а не молчаливый пропуск.
 *
 * @param resumesDir - директория резюме
 * @param versionIds - ожидаемые версии или undefined
 * @returns файлы и ошибки
 */
export async function selectVersions(resumesDir: string, versionIds?: string[]): Promise<SelectedVersions> {
  let names: string[];

  try {
    names = (await readdir(resumesDir)).filter((name) => /^hh_v1_.+\.json$/.test(name)).sort();
  } catch (error) {
    return { files: [], errors: [{ versionId: "", reason: (error as Error).message }] };
  }

  if (versionIds === undefined) {
    return { files: names, errors: [] };
  }

  const allowed = new Set(versionIds);

  if (allowed.size === 0) {
    return { files: [], errors: [{ versionId: "", reason: "нет свежих версий для проверки" }] };
  }

  const found = new Set(names.map((name) => basename(name, ".json")));
  const errors = [...allowed]
    .sort()
    .filter((versionId) => !found.has(versionId))
    .map((versionId) => ({ versionId, reason: "файл версии не найден" }));

  return { files: names.filter((name) => allowed.has(basename(name, ".json"))), errors };
}
