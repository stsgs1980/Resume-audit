import { describe, expect, it } from "vitest";
import { cleanForLlm } from "./clean-text";

describe("cleanForLlm()", () => {
  it("удаляет class/id", () => {
    expect(cleanForLlm('<div class="resume__title" id="top">Менеджер</div>')).toBe("Менеджер");
  });

  it("удаляет HTML-теги", () => {
    expect(cleanForLlm("<p>Опыт <b>10 лет</b></p>")).toBe("Опыт 10 лет");
  });

  it("сохраняет текст резюме", () => {
    const text = "Иван Петров, 2003-10, выручка 4,2 млн руб., ООО Ромашка";

    expect(cleanForLlm(text)).toContain(text);
  });

  it("на plain text — no-op", () => {
    expect(cleanForLlm("Простой текст без разметки")).toBe("Простой текст без разметки");
  });

  it("схлопывает множественные пробелы", () => {
    expect(cleanForLlm("Опыт    работы")).toBe("Опыт работы");
  });

  it("3+ переноса схлопывает в 2", () => {
    expect(cleanForLlm("Абзац один\n\n\n\nАбзац два")).toBe("Абзац один\n\nАбзац два");
  });

  it("убирает BOM", () => {
    expect(cleanForLlm(`${String.fromCharCode(0xfeff)}Текст`)).toBe("Текст");
  });
});
