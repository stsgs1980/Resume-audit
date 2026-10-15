import { describe, expect, it } from "vitest";
import { chunkText, needsChunking } from "./chunk";

describe("needsChunking()", () => {
  it("короткий текст -> false", () => {
    expect(needsChunking("коротко", 100)).toBe(false);
  });

  it("длинный текст -> true", () => {
    expect(needsChunking("x".repeat(101), 100)).toBe(true);
  });
});

describe("chunkText()", () => {
  it("текст меньше порога -> один чанк", () => {
    expect(chunkText("коротко", 100)).toEqual(["коротко"]);
  });

  it("текст больше порога -> несколько чанков", () => {
    const text = ["абзац один", "абзац два", "абзац три", "абзац четыре"].join("\n\n");
    const chunks = chunkText(text, 30);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(" ")).toContain("абзац четыре");
  });

  it("перекрытие 10%: начало следующего содержит хвост предыдущего", () => {
    const text = ["a".repeat(40), "b".repeat(40), "c".repeat(40)].join("\n\n");
    const chunks = chunkText(text, 100);

    expect(chunks.length).toBeGreaterThan(1);

    const overlap = chunks[0]?.slice(-10) ?? "";

    expect(chunks[1]?.startsWith(overlap)).toBe(true);
  });
});
