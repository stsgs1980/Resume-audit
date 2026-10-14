import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildAuthHeader, readServicePassword, resetAuthCache } from "./auth";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "llm-auth-"));
  resetAuthCache();
});

afterEach(async () => {
  resetAuthCache();
  await rm(dir, { recursive: true, force: true });
});

describe("readServicePassword", () => {
  it("читает password из файла", async () => {
    const filePath = join(dir, "service.json");

    await writeFile(filePath, JSON.stringify({ password: "secret-1" }), "utf8");

    expect(await readServicePassword(filePath)).toBe("secret-1");
  });

  it("отсутствующий файл -> throw с понятной ошибкой", async () => {
    await expect(readServicePassword(join(dir, "missing.json"))).rejects.toThrow(/LLM service file not found/);
  });

  it("файл без password -> throw", async () => {
    const filePath = join(dir, "service.json");

    await writeFile(filePath, JSON.stringify({}), "utf8");

    await expect(readServicePassword(filePath)).rejects.toThrow(/password/);
  });
});

describe("buildAuthHeader", () => {
  it("формирует Basic opencode:password в base64", () => {
    expect(buildAuthHeader("pw")).toBe(`Basic ${Buffer.from("opencode:pw").toString("base64")}`);
  });
});

describe("resetAuthCache", () => {
  it("вызов не бросает и сбрасывает кэш", () => {
    expect(() => resetAuthCache()).not.toThrow();
  });
});
