import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmClient } from "../../llm/client";
import type { LlmCallResult } from "../../llm/types";
import type { FileEntry } from "../stage1/types";
import { runStage2 } from "./index";

let dir = "";
let promptsDir = "";

const entry = (overrides: Partial<FileEntry> = {}): FileEntry => ({
  path: "resume.txt",
  name: "resume.txt",
  kind: "resume_draft",
  status: "ok",
  encoding: "utf-8",
  warnings: [],
  size: 10,
  ...overrides,
});

const writeFilesJson = async (files: FileEntry[]) =>
  writeFile(
    join(dir, "files.json"),
    JSON.stringify({ rootDir: dir, scannedAt: "", totalFiles: files.length, files, errors: [] }),
    "utf8",
  );

const okClient = (claims: unknown[]): LlmClient => ({
  health: () => Promise.resolve(true),
  call: <T>(): Promise<LlmCallResult<T>> => Promise.resolve({ ok: true, data: { claims } as unknown as T }),
});

const claim = (quote: string) => ({
  statement: "утверждение",
  quote,
  source_file: "resume.txt",
  category: "result",
  metric_type: "выручка",
  number: 1,
  currency: null,
  status: "confirmed",
  reason: "",
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage2-run-"));
  promptsDir = join(dir, "prompts");

  await mkdir(promptsDir, { recursive: true });
  await writeFile(join(promptsDir, "extraction.v1.md"), "# extraction", "utf8");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runStage2()", () => {
  it("пустой files.json -> totalClaims 0, warnings", async () => {
    await writeFilesJson([]);

    const result = await runStage2({
      filesPath: join(dir, "files.json"),
      claimsPath: join(dir, "claims.json"),
      llmClient: okClient([]),
      promptConfig: { promptsDir },
    });

    expect(result.totalClaims).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("один файл, три claims -> totalClaims 3", async () => {
    await writeFile(join(dir, "resume.txt"), "Опыт работы — 10 лет", "utf8");
    await writeFilesJson([entry()]);

    const result = await runStage2({
      filesPath: join(dir, "files.json"),
      claimsPath: join(dir, "claims.json"),
      llmClient: okClient([claim("цитата один"), claim("цитата два"), claim("цитата три")]),
      promptConfig: { promptsDir },
    });

    expect(result.totalClaims).toBe(3);
    expect(result.byFile).toEqual({ "resume.txt": 3 });
  });

  it("flagged_synthetic пропускается", async () => {
    await writeFilesJson([entry({ path: "bad.txt", name: "bad.txt", kind: "flagged_synthetic" })]);

    const client = okClient([]);
    const call = vi.spyOn(client, "call");
    const result = await runStage2({
      filesPath: join(dir, "files.json"),
      claimsPath: join(dir, "claims.json"),
      llmClient: client,
      promptConfig: { promptsDir },
    });

    expect(call).not.toHaveBeenCalled();
    expect(result.skipped).toHaveLength(1);
    expect(result.totalClaims).toBe(0);
  });

  it("файл с ошибкой LLM -> в errors, остальные обрабатываются", async () => {
    await writeFile(join(dir, "good.txt"), "ХОРОШИЙ ТЕКСТ", "utf8");
    await writeFile(join(dir, "bad.txt"), "плохой текст", "utf8");
    await writeFilesJson([entry({ path: "good.txt", name: "good.txt" }), entry({ path: "bad.txt", name: "bad.txt" })]);

    const client: LlmClient = {
      health: () => Promise.resolve(true),
      call: <T>(params: { user: string }): Promise<LlmCallResult<T>> =>
        params.user.includes("ХОРОШИЙ")
          ? Promise.resolve({ ok: true, data: { claims: [claim("цитата")] } as unknown as T })
          : Promise.resolve({ ok: false, error: { kind: "unavailable", message: "down" } }),
    };

    const result = await runStage2({
      filesPath: join(dir, "files.json"),
      claimsPath: join(dir, "claims.json"),
      llmClient: client,
      promptConfig: { promptsDir },
    });

    expect(result.errors).toHaveLength(1);
    expect(result.totalClaims).toBe(1);
  });

  it("файл с чанкингом обрабатывается по частям", async () => {
    const big = ["абзац один текст", "абзац два текст", "абзац три текст", "абзац четыре"].join("\n\n");

    await writeFile(join(dir, "big.txt"), big, "utf8");
    await writeFilesJson([entry({ path: "big.txt", name: "big.txt" })]);

    let calls = 0;
    const call = async <T>(): Promise<LlmCallResult<T>> => {
      calls += 1;

      return {
        ok: true,
        data: { claims: [claim(`цитата ${calls}`)] } as unknown as T,
      };
    };
    const client: LlmClient = { health: () => Promise.resolve(true), call };

    const result = await runStage2({
      filesPath: join(dir, "files.json"),
      claimsPath: join(dir, "claims.json"),
      llmClient: client,
      promptConfig: { promptsDir },
      chunkThreshold: 40,
    });

    expect(calls).toBeGreaterThan(1);
    expect(result.totalClaims).toBeGreaterThan(1);
  });

  it("claims.json записан атомарно", async () => {
    await writeFile(join(dir, "resume.txt"), "текст", "utf8");
    await writeFilesJson([entry()]);

    const result = await runStage2({
      filesPath: join(dir, "files.json"),
      claimsPath: join(dir, "claims.json"),
      llmClient: okClient([claim("цитата")]),
      promptConfig: { promptsDir },
    });
    const stored = JSON.parse(await readFile(join(dir, "claims.json"), "utf8")) as {
      claims: unknown[];
    };

    expect(stored.claims).toHaveLength(result.totalClaims);
  });

  it("дубликаты по quote из разных файлов склеены", async () => {
    await writeFile(join(dir, "a.txt"), "текст а", "utf8");
    await writeFile(join(dir, "b.txt"), "текст б", "utf8");
    await writeFilesJson([entry({ path: "a.txt", name: "a.txt" }), entry({ path: "b.txt", name: "b.txt" })]);

    const result = await runStage2({
      filesPath: join(dir, "files.json"),
      claimsPath: join(dir, "claims.json"),
      llmClient: okClient([claim("одна цитата")]),
      promptConfig: { promptsDir },
    });

    expect(result.totalClaims).toBe(1);
    expect(result.claims[0]?.id).toBe("claim1");
  });
});
