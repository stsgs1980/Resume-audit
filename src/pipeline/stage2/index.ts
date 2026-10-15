import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { savePartialResponse } from "../../llm/checkpoint";
import { writeJsonAtomic } from "../../server/storage/files";
import { readAnyFile } from "../stage1/read-file";
import type { FileEntry } from "../stage1/types";
import { chunkText, needsChunking } from "./chunk";
import { cleanForLlm } from "./clean-text";
import { extractClaimsFromFile } from "./extract";
import { mergeClaimsByQuote, validateAndCleanClaims } from "./postprocess";
import type { Claim, ClaimsResult, RawClaim, Stage2Params } from "./types";

/** Порог чанкинга по умолчанию: 60 000 символов. */
const DEFAULT_CHUNK_THRESHOLD = 60_000;

/** Директория частичных ответов по умолчанию. */
const DEFAULT_PARTIAL_DIR = "data/partial";

/**
 * Обрабатывает один файл: чтение, очистка, чанки, извлечение, чистка.
 *
 * @param entry - запись файла
 * @param rootDir - корень исходных файлов
 * @param params - параметры этапа
 * @param nextId - следующий номер id
 * @returns утверждения файла, ошибки и следующий номер
 */
async function processFile(
  entry: FileEntry,
  rootDir: string,
  params: Stage2Params,
  nextId: number,
): Promise<{ claims: Claim[]; errors: Array<{ file: string; reason: string }>; nextId: number }> {
  const errors: Array<{ file: string; reason: string }> = [];
  const rawClaims: RawClaim[] = [];
  const threshold = params.chunkThreshold ?? DEFAULT_CHUNK_THRESHOLD;
  const partialDir = params.partialDir ?? DEFAULT_PARTIAL_DIR;
  let text: string;

  try {
    const read = await readAnyFile(join(rootDir, entry.path));

    text = cleanForLlm(read.text);
  } catch (error) {
    errors.push({ file: entry.path, reason: (error as Error).message });

    return { claims: [], errors, nextId };
  }

  const chunks = needsChunking(text, threshold) ? chunkText(text, threshold) : [text];

  for (const chunk of chunks) {
    try {
      const { claims, error } = await extractClaimsFromFile(entry, chunk, params.llmClient, params.promptConfig);

      if (error !== null) {
        errors.push({ file: entry.path, reason: error });
        await savePartialResponse(partialDir, "stage2", rawClaims);

        continue;
      }

      rawClaims.push(...claims);
    } catch (error) {
      errors.push({ file: entry.path, reason: (error as Error).message });
      await savePartialResponse(partialDir, "stage2", rawClaims);
    }
  }

  const claims = validateAndCleanClaims(rawClaims, entry.path, nextId);

  return { claims, errors, nextId: nextId + claims.length };
}

/**
 * Запускает этап 2: извлечение утверждений через LLM.
 * Исключения наружу не бросает: всё фиксируется в errors/warnings.
 *
 * @param params - filesPath, claimsPath, клиент, промты и лимиты
 * @returns итог этапа
 */
export async function runStage2(params: Stage2Params): Promise<ClaimsResult> {
  const result: ClaimsResult = {
    generatedAt: new Date().toISOString(),
    totalClaims: 0,
    claims: [],
    byFile: {},
    skipped: [],
    errors: [],
    warnings: [],
  };
  const collected: Claim[] = [];
  let nextId = 1;
  let parsed: { rootDir?: unknown; files?: unknown };

  try {
    parsed = JSON.parse(await readFile(params.filesPath, "utf8")) as {
      rootDir?: unknown;
      files?: unknown;
    };
  } catch (error) {
    result.errors.push({ file: params.filesPath, reason: (error as Error).message });

    return result;
  }

  if (typeof parsed.rootDir !== "string" || !Array.isArray(parsed.files)) {
    result.errors.push({ file: params.filesPath, reason: "files.json имеет неверную форму" });

    return result;
  }

  const entries = parsed.files as FileEntry[];
  const limited = params.maxFilesToProcess === undefined ? entries : entries.slice(0, params.maxFilesToProcess);

  for (const entry of limited) {
    if (entry.kind === "flagged_synthetic") {
      result.skipped.push({ file: entry.path, reason: "flagged_synthetic: пропущен" });

      continue;
    }

    if (entry.status !== "ok") {
      result.skipped.push({ file: entry.path, reason: `status ${entry.status}: пропущен` });

      continue;
    }

    try {
      const processed = await processFile(entry, parsed.rootDir, params, nextId);

      nextId = processed.nextId;
      result.errors.push(...processed.errors);

      if (processed.claims.length > 0) {
        collected.push(...processed.claims);
        result.byFile[entry.path] = processed.claims.length;
      }
    } catch (error) {
      result.errors.push({ file: entry.path, reason: (error as Error).message });
    }
  }

  result.claims = mergeClaimsByQuote(collected);
  result.totalClaims = result.claims.length;

  if (result.claims.length === 0) {
    result.warnings.push("Ни одного утверждения не извлечено");
  }

  try {
    await writeJsonAtomic(params.claimsPath, result);
  } catch (error) {
    result.errors.push({ file: params.claimsPath, reason: (error as Error).message });
  }

  return result;
}
