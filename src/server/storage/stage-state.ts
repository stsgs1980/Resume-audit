import type { StageState } from "../../schemas/stage-state";
import { stageStateSchema } from "../../schemas/stage-state";
import { readJson, writeJsonAtomic } from "./files";
import type { StorageConfig } from "./paths";
import { getStageStatePath } from "./paths";

/**
 * Пустое состояние для workspace без файла.
 *
 * @returns минимальная структура stage-state
 */
function emptyStageState(): StageState {
  return { run_id: "", stages: {}, documents: {} };
}

/**
 * Читает stage-state. Файла нет — минимальная структура.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @returns состояние этапов
 */
export async function readStageState(config: StorageConfig, slug: string): Promise<StageState> {
  try {
    return await readJson(getStageStatePath(config, slug), stageStateSchema);
  } catch (error) {
    if ((error as Error).name === "FileNotFoundError") {
      return emptyStageState();
    }

    throw error;
  }
}

/**
 * Записывает stage-state атомарно.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @param state - новое состояние
 * @returns void
 */
export async function writeStageState(config: StorageConfig, slug: string, state: StageState): Promise<void> {
  await writeJsonAtomic(getStageStatePath(config, slug), state);
}

/**
 * Помечает один документ stale при расхождении хеша.
 * Другие документы не трогает (по-документная инвалидация).
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @param documentId - id документа
 * @param currentFactsHash - актуальный facts_hash
 * @returns true, если документ помечен; false, если нечего менять
 */
export async function markDocumentStale(
  config: StorageConfig,
  slug: string,
  documentId: string,
  currentFactsHash: string,
): Promise<boolean> {
  const state = await readStageState(config, slug);
  const document = state.documents[documentId];

  if (document === undefined || document.facts_hash === currentFactsHash) {
    return false;
  }

  await writeStageState(config, slug, {
    ...state,
    documents: {
      ...state.documents,
      [documentId]: { ...document, facts_hash: currentFactsHash, stale: true },
    },
  });

  return true;
}

/**
 * Помечает stale все документы с несовпадающим хешем.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @param currentFactsHash - актуальный facts_hash
 * @returns id документов, которые изменились
 */
export async function invalidateAllDocuments(
  config: StorageConfig,
  slug: string,
  currentFactsHash: string,
): Promise<string[]> {
  const state = await readStageState(config, slug);
  const changed: string[] = [];

  for (const [documentId, document] of Object.entries(state.documents)) {
    if (document.stale !== true && document.facts_hash !== currentFactsHash) {
      changed.push(documentId);
    }
  }

  if (changed.length === 0) {
    return changed;
  }

  const documents = { ...state.documents };

  for (const documentId of changed) {
    const document = documents[documentId];

    if (document !== undefined) {
      documents[documentId] = { ...document, facts_hash: currentFactsHash, stale: true };
    }
  }

  await writeStageState(config, slug, { ...state, documents });

  return changed;
}
