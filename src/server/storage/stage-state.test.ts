import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { StageState } from "../../schemas/stage-state";
import type { StorageConfig } from "./paths";
import { invalidateAllDocuments, markDocumentStale, readStageState, writeStageState } from "./stage-state";

let dir = "";
let config: StorageConfig = { rootDir: "" };

const stateWithDocs = (hashA: string, hashB: string): StageState => ({
  run_id: "run_1",
  stages: { 1: { status: "completed", updated_at: "" } },
  documents: {
    doc_a: { facts_hash: hashA, stale: false },
    doc_b: { facts_hash: hashB, stale: false },
  },
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "storage-stage-"));
  config = { rootDir: dir };
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("readStageState", () => {
  it("нет файла -> минимальная структура", async () => {
    expect(await readStageState(config, "ws1")).toEqual({
      run_id: "",
      stages: {},
      documents: {},
    });
  });

  it("запись и чтение (roundtrip)", async () => {
    const state = stateWithDocs("sha256:a", "sha256:b");

    await writeStageState(config, "ws1", state);

    expect(await readStageState(config, "ws1")).toEqual(state);
  });
});

describe("markDocumentStale", () => {
  it("тот же facts_hash -> false", async () => {
    await writeStageState(config, "ws1", stateWithDocs("sha256:a", "sha256:b"));

    expect(await markDocumentStale(config, "ws1", "doc_a", "sha256:a")).toBe(false);
  });

  it("другой facts_hash -> true, файл обновлён", async () => {
    await writeStageState(config, "ws1", stateWithDocs("sha256:a", "sha256:b"));

    expect(await markDocumentStale(config, "ws1", "doc_a", "sha256:new")).toBe(true);

    const updated = await readStageState(config, "ws1");

    expect(updated.documents["doc_a"]?.stale).toBe(true);
  });

  it("не трогает чужие документы", async () => {
    await writeStageState(config, "ws1", stateWithDocs("sha256:a", "sha256:b"));

    await markDocumentStale(config, "ws1", "doc_a", "sha256:new");

    const updated = await readStageState(config, "ws1");

    expect(updated.documents["doc_b"]).toEqual({ facts_hash: "sha256:b", stale: false });
  });

  it("неизвестный документ -> false", async () => {
    await writeStageState(config, "ws1", stateWithDocs("sha256:a", "sha256:b"));

    expect(await markDocumentStale(config, "ws1", "doc_x", "sha256:new")).toBe(false);
  });
});

describe("invalidateAllDocuments", () => {
  it("возвращает только изменённые ID", async () => {
    await writeStageState(config, "ws1", stateWithDocs("sha256:a", "sha256:current"));

    const changed = await invalidateAllDocuments(config, "ws1", "sha256:current");

    expect(changed).toEqual(["doc_a"]);

    const updated = await readStageState(config, "ws1");

    expect(updated.documents["doc_b"]?.stale).toBe(false);
  });
});
