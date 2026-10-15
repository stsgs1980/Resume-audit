import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PromptConfig } from "./prompts";
import { listPrompts, loadPrompt, PromptNotFoundError, resetPromptCache } from "./prompts";

let dir = "";
let config: PromptConfig = { promptsDir: "" };

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "llm-prompts-"));
  config = { promptsDir: dir };
  resetPromptCache();
});

afterEach(async () => {
  resetPromptCache();
  await rm(dir, { recursive: true, force: true });
});

describe("loadPrompt()", () => {
  it("читает файл промта", async () => {
    await writeFile(join(dir, "extraction.v1.md"), "# extraction", "utf8");

    expect(await loadPrompt("extraction", 1, config)).toBe("# extraction");
  });

  it("кэш возвращает тот же результат", async () => {
    const filePath = join(dir, "extraction.v1.md");

    await writeFile(filePath, "v1", "utf8");
    expect(await loadPrompt("extraction", 1, config)).toBe("v1");

    await writeFile(filePath, "v2", "utf8");
    expect(await loadPrompt("extraction", 1, config)).toBe("v1");
  });

  it("resetPromptCache очищает кэш", async () => {
    const filePath = join(dir, "extraction.v1.md");

    await writeFile(filePath, "v1", "utf8");
    expect(await loadPrompt("extraction", 1, config)).toBe("v1");

    await writeFile(filePath, "v2", "utf8");
    resetPromptCache();

    expect(await loadPrompt("extraction", 1, config)).toBe("v2");
  });

  it("несуществующий промт -> PromptNotFoundError", async () => {
    await expect(loadPrompt("missing", 1, config)).rejects.toThrow(PromptNotFoundError);
  });
});

describe("listPrompts()", () => {
  it("возвращает отсортированный список", async () => {
    await writeFile(join(dir, "roles.v1.md"), "r", "utf8");
    await writeFile(join(dir, "extraction.v1.md"), "e", "utf8");
    await writeFile(join(dir, "notes.txt"), "x", "utf8");

    expect(await listPrompts(config)).toEqual([
      { id: "extraction", version: 1, path: join(dir, "extraction.v1.md") },
      { id: "roles", version: 1, path: join(dir, "roles.v1.md") },
    ]);
  });

  it("пустая директория -> []", async () => {
    expect(await listPrompts(config)).toEqual([]);
  });
});
