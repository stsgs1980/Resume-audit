import { describe, expect, it } from "vitest";
import { classifyFile } from "./classify";

describe("classifyFile()", () => {
  it("разметка hh.ru -> hh_export", () => {
    expect(classifyFile('<div class="resume__title">Менеджер</div> Опыт работы — 5 лет', "hh.html")).toBe("hh_export");
  });

  it("Обязанности + Требования -> vacancy", () => {
    expect(classifyFile("Обязанности: вести отдел. Требования: опыт 5 лет. Условия: офис.", "job.txt")).toBe("vacancy");
  });

  it("Ключевые компетенции -> resume_draft", () => {
    expect(classifyFile("Ключевые компетенции: продажи, переговоры", "draft.md")).toBe("resume_draft");
  });

  it("production-стандарты -> ai_inflated", () => {
    expect(classifyFile("Внедрил production-стандарты в команде", "draft.md")).toBe("ai_inflated");
  });

  it("2+ placeholder-паттерна -> flagged_synthetic", () => {
    expect(classifyFile("Тел. +7 (XXX) XXX-XX-XX, почта ivan@example.com", "draft.md")).toBe("flagged_synthetic");
  });

  it("grep + репозитори -> technical_audit", () => {
    expect(classifyFile("Проверил grep по всему репозитори, запуском тестов", "audit.md")).toBe("technical_audit");
  });

  it("пустой текст -> unknown", () => {
    expect(classifyFile("", "empty.txt")).toBe("unknown");
  });

  it("один placeholder -> не flagged_synthetic", () => {
    expect(classifyFile("Связаться: @username", "draft.md")).not.toBe("flagged_synthetic");
  });
});
