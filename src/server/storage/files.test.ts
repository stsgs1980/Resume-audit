import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { FileNotFoundError, InvalidJsonError, SchemaValidationError } from "./errors";
import { fileExists, readJson, writeJsonAtomic } from "./files";

const payloadSchema = z.object({ id: z.string(), n: z.number() });

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "storage-files-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("writeJsonAtomic", () => {
  it("создаёт файл, читается обратно", async () => {
    const filePath = join(dir, "a.json");

    await writeJsonAtomic(filePath, { id: "x", n: 1 });

    expect(await readJson(filePath, payloadSchema)).toEqual({ id: "x", n: 1 });
  });

  it("перезапись существующего файла проходит", async () => {
    const filePath = join(dir, "a.json");

    await writeJsonAtomic(filePath, { id: "x", n: 1 });
    await writeJsonAtomic(filePath, { id: "x", n: 2 });

    expect(await readJson(filePath, payloadSchema)).toEqual({ id: "x", n: 2 });
  });

  it("не оставляет tmp-файлов после записи", async () => {
    const filePath = join(dir, "a.json");

    await writeJsonAtomic(filePath, { id: "x", n: 1 });
    await writeJsonAtomic(filePath, { id: "x", n: 2 });

    const leftovers = (await readdir(dir)).filter((name) => name.includes(".tmp."));

    expect(leftovers).toEqual([]);
  });
});

describe("readJson: ошибки", () => {
  it("несуществующий файл -> FileNotFoundError", async () => {
    await expect(readJson(join(dir, "missing.json"), payloadSchema)).rejects.toThrow(FileNotFoundError);
  });

  it("битый JSON -> InvalidJsonError", async () => {
    const filePath = join(dir, "broken.json");

    await writeFile(filePath, '{"id": ', "utf8");

    await expect(readJson(filePath, payloadSchema)).rejects.toThrow(InvalidJsonError);
  });

  it("несоответствие схеме -> SchemaValidationError", async () => {
    const filePath = join(dir, "bad.json");

    await writeJsonAtomic(filePath, { id: "x", n: "not-a-number" });

    await expect(readJson(filePath, payloadSchema)).rejects.toThrow(SchemaValidationError);
  });
});

describe("fileExists", () => {
  it("true для существующего, false для отсутствующего", async () => {
    const filePath = join(dir, "a.json");

    expect(await fileExists(filePath)).toBe(false);

    await writeJsonAtomic(filePath, { id: "x", n: 1 });

    expect(await fileExists(filePath)).toBe(true);
  });
});
