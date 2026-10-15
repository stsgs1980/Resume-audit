import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decodeBuffer, detectEncoding, readAnyFile, readHtmlFile, readTextFile } from "./read-file";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage1-read-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("detectEncoding()", () => {
  it("UTF-8 текст -> utf-8", () => {
    const buffer = Buffer.from("Привет, это тестовый текст на русском языке для определения кодировки", "utf-8");

    expect(detectEncoding(buffer).encoding).toBe("utf-8");
  });

  it("windows-1251 текст -> windows-1251", async () => {
    const { default: iconv } = await import("iconv-lite");
    const buffer = iconv.encode(
      "Привет, это тестовый текст на русском языке для определения кодировки файла",
      "windows-1251",
    );

    expect(detectEncoding(buffer).encoding).toBe("windows-1251");
  });
});

describe("decodeBuffer()", () => {
  it("декодирует windows-1251 корректно", async () => {
    const { default: iconv } = await import("iconv-lite");
    const original = "Выручка 4,2 млн руб.";
    const buffer = iconv.encode(original, "windows-1251");

    expect(decodeBuffer(buffer, "windows-1251")).toBe(original);
  });
});

describe("readTextFile()", () => {
  it("читает .txt", async () => {
    const filePath = join(dir, "note.txt");

    await writeFile(filePath, "Опыт работы — 10 лет", "utf-8");

    const result = await readTextFile(filePath);

    expect(result.text).toContain("Опыт работы");
    expect(result.encoding).toBe("utf-8");
  });
});

describe("readHtmlFile()", () => {
  it("вырезает script/style и берёт текст", async () => {
    const filePath = join(dir, "page.html");

    await writeFile(
      filePath,
      "<html><head><style>.x{color:red}</style><script>alert(1)</script></head>" +
        "<body><h1>Резюме</h1><p>Опыт работы — 10 лет</p><ul><li>Продажи</li></ul></body></html>",
      "utf-8",
    );

    const text = await readHtmlFile(filePath);

    expect(text).toContain("Резюме");
    expect(text).toContain("Опыт работы");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color:red");
  });
});

describe("readAnyFile()", () => {
  it(".unknown -> throw Неподдерживаемое расширение", async () => {
    const filePath = join(dir, "file.unknown");

    await writeFile(filePath, "data", "utf8");

    await expect(readAnyFile(filePath)).rejects.toThrow("Неподдерживаемое расширение");
  });

  it("битый pdf -> throw с понятным сообщением", async () => {
    const filePath = join(dir, "broken.pdf");

    await writeFile(filePath, Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]));

    await expect(readAnyFile(filePath)).rejects.toThrow("PDF не распознан");
  });

  it("битый docx -> throw с понятным сообщением", async () => {
    const filePath = join(dir, "broken.docx");

    await writeFile(filePath, "не zip-архив", "utf8");

    await expect(readAnyFile(filePath)).rejects.toThrow("повреждён");
  });
});
