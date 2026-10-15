import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runStage1 } from "./index";

let dir = "";
let out = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage1-run-"));
  out = join(dir, "out", "files.json");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runStage1()", () => {
  it("пустая директория -> totalFiles 0", async () => {
    const result = await runStage1({ rootDir: dir, outputPath: out });

    expect(result.totalFiles).toBe(0);
    expect(result.files).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("3 файла разных типов -> 3 записи с kind", async () => {
    await writeFile(join(dir, "hh.html"), '<div class="resume__title">Менеджер</div>', "utf8");
    await writeFile(join(dir, "job.txt"), "Обязанности: вести. Требования: опыт.", "utf8");
    await writeFile(join(dir, "draft.md"), "Ключевые компетенции: продажи", "utf8");

    const result = await runStage1({ rootDir: dir, outputPath: out });
    const kinds = Object.fromEntries(result.files.map((file) => [file.name, file.kind]));

    expect(result.totalFiles).toBe(3);
    expect(kinds).toEqual({ "hh.html": "hh_export", "job.txt": "vacancy", "draft.md": "resume_draft" });
  });

  it("файл больше лимита -> unsupported", async () => {
    await writeFile(join(dir, "big.txt"), "x".repeat(100), "utf8");

    const result = await runStage1({ rootDir: dir, outputPath: out, maxFileSizeBytes: 10 });
    const entry = result.files.find((file) => file.name === "big.txt");

    expect(entry?.status).toBe("unsupported");
    expect(entry?.warnings).toContain("Превышен лимит размера");
  });

  it("неподдерживаемое расширение -> unsupported", async () => {
    await writeFile(join(dir, "photo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const result = await runStage1({ rootDir: dir, outputPath: out });
    const entry = result.files.find((file) => file.name === "photo.png");

    expect(entry?.status).toBe("unsupported");
  });

  it("битый docx -> unreadable, этап не падает", async () => {
    await writeFile(join(dir, "broken.docx"), "не zip-архив", "utf8");
    await writeFile(join(dir, "ok.txt"), "Опыт работы — 10 лет. Ключевые компетенции: продажи", "utf8");

    const result = await runStage1({ rootDir: dir, outputPath: out });
    const broken = result.files.find((file) => file.name === "broken.docx");

    expect(broken?.status).toBe("unreadable");
    expect(result.files.find((file) => file.name === "ok.txt")?.status).toBe("ok");
  });

  it("лимит maxFiles: третий в warnings", async () => {
    await writeFile(join(dir, "a.txt"), "текст", "utf8");
    await writeFile(join(dir, "b.txt"), "текст", "utf8");
    await writeFile(join(dir, "c.txt"), "текст", "utf8");

    const result = await runStage1({ rootDir: dir, outputPath: out, maxFiles: 2 });

    expect(result.files).toHaveLength(2);
    expect(result.warnings.some((warning) => warning.includes("c.txt"))).toBe(true);
  });

  it("files.json записывается и читается", async () => {
    await writeFile(join(dir, "a.txt"), "текст", "utf8");

    const result = await runStage1({ rootDir: dir, outputPath: out });
    const stored = JSON.parse(await readFile(out, "utf8")) as { totalFiles: number };

    expect(stored.totalFiles).toBe(result.totalFiles);
  });
});
