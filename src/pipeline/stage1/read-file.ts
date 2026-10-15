import chardet from "chardet";
import iconv from "iconv-lite";
import mammoth from "mammoth";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { PDFParse } from "pdf-parse";

/** Поддерживаемые текстовые расширения. */
const TEXT_EXTENSIONS = new Set([".md", ".txt"]);

/** Расширения HTML. */
const HTML_EXTENSIONS = new Set([".html", ".htm"]);

/**
 * Определяет кодировку буфера через chardet.
 *
 * @param buffer - сырые байты файла
 * @returns кодировка и уверенность
 */
export function detectEncoding(buffer: Buffer): { encoding: string; confident: boolean } {
  const [top] = chardet.analyse(buffer);
  const name = (top?.name ?? "").toLowerCase();
  const confident = top !== undefined && top.confidence / 100 > 0.8;

  if (name === "utf-8" || name === "ascii") {
    return { encoding: "utf-8", confident };
  }

  if (name === "windows-1251" || name === "iso-8859-5" || name === "koi8-r") {
    return { encoding: "windows-1251", confident };
  }

  return { encoding: "unknown", confident: false };
}

/**
 * Декодирует буфер в указанной кодировке.
 *
 * @param buffer - сырые байты файла
 * @param encoding - кодировка из detectEncoding
 * @returns текст
 */
export function decodeBuffer(buffer: Buffer, encoding: string): string {
  if (encoding === "windows-1251") {
    return iconv.decode(buffer, "windows-1251");
  }

  return buffer.toString("utf-8");
}

/**
 * Читает текстовый файл с определением кодировки.
 *
 * @param filePath - путь к файлу
 * @returns текст и кодировка
 */
export async function readTextFile(filePath: string): Promise<{ text: string; encoding: string }> {
  let buffer: Buffer;

  try {
    buffer = await readFile(filePath);
  } catch (error) {
    throw new Error(`Не удалось прочитать файл ${basename(filePath)}: ${(error as Error).message}`);
  }

  const { encoding } = detectEncoding(buffer);

  return { text: decodeBuffer(buffer, encoding), encoding };
}

/**
 * Читает .docx через mammoth.
 *
 * @param filePath - путь к файлу
 * @returns извлечённый текст
 */
export async function readDocxFile(filePath: string): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ path: filePath });

    return result.value;
  } catch {
    throw new Error(`Файл защищён паролем или повреждён: ${basename(filePath)}`);
  }
}

/**
 * Читает .pdf через pdf-parse.
 *
 * @param filePath - путь к файлу
 * @returns извлечённый текст
 */
export async function readPdfFile(filePath: string): Promise<string> {
  let buffer: Buffer;

  try {
    buffer = await readFile(filePath);
  } catch (error) {
    throw new Error(`Не удалось прочитать файл ${basename(filePath)}: ${(error as Error).message}`);
  }

  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    await parser.destroy();

    return result.text;
  } catch {
    throw new Error(`PDF не распознан (скан или шифрование): ${basename(filePath)}`);
  }
}

/**
 * Вырезает скрипты, стили и извлекает текст блочных элементов.
 * Div/section/article/main включены: реальные выгрузки (hh.ru) верстаются дивами.
 *
 * @param html - исходный HTML
 * @returns чистый текст
 */
function extractHtmlText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n");
  const blocks: string[] = [];
  const blockPattern = /<(p|li|h[1-6]|div|section|article|main)[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(withoutScripts)) !== null) {
    blocks.push((match[2] ?? "").replace(/<[^>]+>/g, "").trim());
  }

  const classes: string[] = [];
  const classPattern = /(?:class|id)="([^"]*)"/gi;
  let classMatch: RegExpExecArray | null;

  while ((classMatch = classPattern.exec(withoutScripts)) !== null) {
    classes.push(classMatch[1] ?? "");
  }

  const source = blocks.length > 0 ? [...blocks, ...classes].join("\n") : withoutScripts.replace(/<[^>]+>/g, "");

  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * Читает HTML-файл: текст плюс очистка разметки.
 *
 * @param filePath - путь к файлу
 * @returns чистый текст
 */
export async function readHtmlFile(filePath: string): Promise<string> {
  const { text } = await readTextFile(filePath);

  return extractHtmlText(text);
}

/**
 * Читает файл любого поддерживаемого типа по расширению.
 *
 * @param filePath - путь к файлу
 * @returns текст и кодировка (null для бинарных)
 */
export async function readAnyFile(filePath: string): Promise<{ text: string; encoding: string | null }> {
  const extension = extname(filePath).toLowerCase();

  if (TEXT_EXTENSIONS.has(extension)) {
    return readTextFile(filePath);
  }

  if (HTML_EXTENSIONS.has(extension)) {
    return { text: await readHtmlFile(filePath), encoding: "utf-8" };
  }

  if (extension === ".docx") {
    return { text: await readDocxFile(filePath), encoding: null };
  }

  if (extension === ".pdf") {
    return { text: await readPdfFile(filePath), encoding: null };
  }

  throw new Error(`Неподдерживаемое расширение: ${extension || "(нет)"} (${basename(filePath)})`);
}
