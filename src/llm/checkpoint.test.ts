import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readCheckpoint, savePartialResponse, writeCheckpoint } from "./checkpoint";
import type { Checkpoint } from "./types";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "llm-checkpoint-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("readCheckpoint()", () => {
  it("null при отсутствии файла", async () => {
    expect(await readCheckpoint(join(dir, "stage-state.json"), "3")).toBeNull();
  });

  it("читает записанное", async () => {
    const checkpoint: Checkpoint = {
      stageId: "3",
      status: "completed",
      updatedAt: "2026-10-14T00:00:00Z",
    };

    await writeCheckpoint(join(dir, "stage-state.json"), checkpoint);

    expect(await readCheckpoint(join(dir, "stage-state.json"), "3")).toEqual(checkpoint);
  });

  it("null для незаписанного stageId", async () => {
    const checkpoint: Checkpoint = { stageId: "3", status: "running", updatedAt: "" };

    await writeCheckpoint(join(dir, "stage-state.json"), checkpoint);

    expect(await readCheckpoint(join(dir, "stage-state.json"), "4")).toBeNull();
  });
});

describe("writeCheckpoint()", () => {
  it("пишет атомарно валидный JSON", async () => {
    const filePath = join(dir, "stage-state.json");

    await writeCheckpoint(filePath, { stageId: "5", status: "failed", updatedAt: "" });

    const parsed = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;

    expect(parsed).toMatchObject({ stages: { 5: { status: "failed" } } });
  });
});

describe("savePartialResponse()", () => {
  it("создаёт файл и возвращает путь", async () => {
    const filePath = await savePartialResponse(dir, "7", { parts: ["a"] });

    expect(filePath.startsWith(dir)).toBe(true);

    const parsed = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;

    expect(parsed).toEqual({ parts: ["a"] });
  });
});
