import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LlmLogEntry, LogConfig } from "./logger";
import { defaultLogConfig, rotateIfNeeded, writeLogEntry } from "./logger";

let dir = "";
let config: LogConfig = { logDir: "", maxFileSizeBytes: 0, maxFiles: 3 };

const entry: LlmLogEntry = {
  timestamp: "2026-10-15T00:00:00.000Z",
  stage: "extraction",
  model: "opencode/space-bunny-free",
  promptLength: 100,
  responseLength: 50,
  durationMs: 123,
  attempts: 1,
  ok: true,
  errorKind: null,
};

const logPath = () => join(dir, "model-responses.log");
const readLines = async () => (await readFile(logPath(), "utf8")).split("\n").filter((line) => line !== "");

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "llm-logger-"));
  config = { ...defaultLogConfig(), logDir: dir, maxFileSizeBytes: 1000 };
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("writeLogEntry()", () => {
  it("создаёт файл с одной JSON-строкой", async () => {
    await writeLogEntry(entry, config);

    expect(await readLines()).toEqual([JSON.stringify(entry)]);
  });

  it("вторая запись добавляется в тот же файл", async () => {
    await writeLogEntry(entry, config);
    await writeLogEntry({ ...entry, attempts: 2 }, config);

    const lines = await readLines();

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1]) as unknown).toMatchObject({ attempts: 2 });
  });

  it("содержимое резюме не попадает в лог", async () => {
    await writeLogEntry(entry, config);

    const text = await readFile(logPath(), "utf8");

    expect(text).not.toContain("SECRET-RESUME-TEXT");
    expect(JSON.parse((await readLines())[0] as string)).toEqual(entry);
  });
});

describe("rotateIfNeeded()", () => {
  it("нет файла -> ничего не делает", async () => {
    await rotateIfNeeded(logPath(), 10, 3);

    expect(await readLines().catch(() => [])).toEqual([]);
  });

  it("большой файл сдвигает .log -> .1 -> .2, .2 удаляется", async () => {
    await writeFile(logPath(), "new-base\n", "utf8");
    await writeFile(join(dir, "model-responses.1.log"), "old-1\n", "utf8");
    await writeFile(join(dir, "model-responses.2.log"), "old-2\n", "utf8");

    await rotateIfNeeded(logPath(), 1, 3);

    expect(await readFile(join(dir, "model-responses.1.log"), "utf8")).toBe("new-base\n");
    expect(await readFile(join(dir, "model-responses.2.log"), "utf8")).toBe("old-1\n");
  });

  it("маленький файл не ротируется", async () => {
    await writeFile(logPath(), "small\n", "utf8");

    await rotateIfNeeded(logPath(), 1000, 3);

    expect(await readFile(logPath(), "utf8")).toBe("small\n");
  });

  it("четыре файла не накапливаются", async () => {
    await writeLogEntry({ ...entry, attempts: 1 }, { ...config, maxFileSizeBytes: 1 });
    await writeLogEntry({ ...entry, attempts: 2 }, { ...config, maxFileSizeBytes: 1 });
    await writeLogEntry({ ...entry, attempts: 3 }, { ...config, maxFileSizeBytes: 1 });

    const third = await readFile(join(dir, "model-responses.2.log"), "utf8").catch(() => null);

    expect(third).not.toBeNull();
    await writeLogEntry({ ...entry, attempts: 4 }, { ...config, maxFileSizeBytes: 1 });

    const lines = await readLines();

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] as string)).toMatchObject({ attempts: 4 });

    const fourth = await readFile(join(dir, "model-responses.3.log"), "utf8").catch(() => null);

    expect(fourth).toBeNull();
  });
});
