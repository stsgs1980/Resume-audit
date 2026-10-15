import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FileKind } from "./types";

/** Маркеры выгрузки hh.ru (resume__ без точки ловит и class="...", и .класс). */
const HH_MARKERS = ["опыт работы —", "опыт работы:", "resume__", "hh.ru"];

/** Маркеры завышенного AI-позиционирования. */
const AI_MARKERS = [
  "ai-консультант",
  "production-стандарты",
  "rag-система",
  "multi-agent",
  "langchain",
  "векторная база данных",
];

/** Маркеры вакансии (нужно 2+). */
const VACANCY_MARKERS = ["обязанности", "требования", "вилка", "условия", "ключевые задачи", "о компании"];

/** Маркеры технического аудита. */
const AUDIT_MARKERS = ["запуском тестов", "grep", "репозитори", "lint", "непрерывная интеграция"];

/** Маркеры черновика резюме. */
const DRAFT_MARKERS = ["ключевые компетенции", "профиль ценности", "масштаб", "достижения", "обо мне"];

/**
 * Загружает placeholder-паттерны из config/placeholders.json.
 *
 * @returns список regex-строк (или [] при отсутствии конфига)
 */
function loadDefaultPatterns(): string[] {
  try {
    const parsed = JSON.parse(readFileSync(join(process.cwd(), "config", "placeholders.json"), "utf8")) as {
      patterns?: unknown;
    };

    if (!Array.isArray(parsed.patterns)) {
      return [];
    }

    return parsed.patterns.filter((pattern): pattern is string => typeof pattern === "string");
  } catch {
    return [];
  }
}

const defaultPatterns = loadDefaultPatterns();

/**
 * Считает совпадения placeholder-паттернов в тексте.
 *
 * @param text - текст файла
 * @param patterns - regex-строки
 * @returns число совпадений
 */
function countPlaceholderHits(text: string, patterns: string[]): number {
  let hits = 0;

  for (const source of patterns) {
    try {
      const matches = text.match(new RegExp(source, "gi"));

      hits += matches === null ? 0 : matches.length;
    } catch {
      // Битый паттерн в конфиге — пропускаем.
    }
  }

  return hits;
}

/**
 * Проверяет вхождение любого маркера (без учёта регистра).
 *
 * @param text - текст в нижнем регистре
 * @param markers - маркеры в нижнем регистре
 * @returns true при совпадении
 */
function hasAnyMarker(text: string, markers: string[]): boolean {
  return markers.some((marker) => text.includes(marker));
}

/**
 * Считает, сколько маркеров встретилось в тексте.
 *
 * @param text - текст в нижнем регистре
 * @param markers - маркеры в нижнем регистре
 * @returns число совпавших маркеров
 */
function countMarkers(text: string, markers: string[]): number {
  return markers.filter((marker) => text.includes(marker)).length;
}

/**
 * Классифицирует файл по содержимому и имени. Первое совпадение побеждает.
 *
 * @param text - текст файла
 * @param name - имя файла
 * @param patterns - placeholder-паттерны (по умолчанию из config)
 * @returns вид файла
 */
export function classifyFile(text: string, name: string, patterns: string[] = defaultPatterns): FileKind {
  if (countPlaceholderHits(text, patterns) >= 2) {
    return "flagged_synthetic";
  }

  const lower = text.toLowerCase();
  const fileName = name.toLowerCase();
  const mentionsResume = fileName.includes("резюме") || fileName.includes("resume");
  const mentionsHhContent = lower.includes("hh.ru") || lower.includes("опыт работы");

  if (hasAnyMarker(lower, HH_MARKERS) || (mentionsResume && mentionsHhContent)) {
    return "hh_export";
  }

  if (hasAnyMarker(lower, AI_MARKERS)) {
    return "ai_inflated";
  }

  if (countMarkers(lower, VACANCY_MARKERS) >= 2) {
    return "vacancy";
  }

  if (hasAnyMarker(lower, AUDIT_MARKERS)) {
    return "technical_audit";
  }

  if (hasAnyMarker(lower, DRAFT_MARKERS)) {
    return "resume_draft";
  }

  return "unknown";
}
