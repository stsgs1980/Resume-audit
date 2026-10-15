import { describe, expect, it } from "vitest";
import { mergeClaimsByQuote, validateAndCleanClaims } from "./postprocess";
import type { RawClaim } from "./types";

const raw = (overrides: Partial<RawClaim> = {}): RawClaim => ({
  statement: "рост выручки",
  quote: "выручка выросла",
  source_file: "a.docx",
  category: "result",
  metric_type: "выручка",
  number: 4200000,
  currency: "RUB",
  status: "confirmed",
  reason: "",
  ...overrides,
});

describe("validateAndCleanClaims()", () => {
  it("claim без quote выброшен", () => {
    expect(validateAndCleanClaims([raw({ quote: "   " })], "a.docx", 1)).toEqual([]);
  });

  it("claim без statement выброшен", () => {
    expect(validateAndCleanClaims([raw({ statement: "" })], "a.docx", 1)).toEqual([]);
  });

  it("claim с неверным status выброшен", () => {
    const bad = { ...raw(), status: "unknown" };

    expect(validateAndCleanClaims([bad as unknown as RawClaim], "a.docx", 1)).toEqual([]);
  });

  it("id присваиваются подряд с startId", () => {
    const cleaned = validateAndCleanClaims([raw(), raw({ quote: "другая цитата" })], "a.docx", 5);

    expect(cleaned.map((claim) => claim.id)).toEqual(["claim5", "claim6"]);
    expect(cleaned[0]?.source_file).toBe("a.docx");
  });
});

describe("mergeClaimsByQuote()", () => {
  it("дубликаты склеиваются", () => {
    const merged = mergeClaimsByQuote([
      { ...raw(), id: "claim1", source_file: "a.docx" },
      { ...raw(), id: "claim2", source_file: "b.docx" },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.source_file).toBe("a.docx");
  });

  it("регистр и whitespace игнорируются", () => {
    const merged = mergeClaimsByQuote([
      { ...raw({ quote: "  Выручка Выросла " }), id: "claim1", source_file: "a.docx" },
      { ...raw({ quote: "выручка выросла" }), id: "claim2", source_file: "b.docx" },
    ]);

    expect(merged).toHaveLength(1);
  });

  it("разные quote не склеиваются, id пересобираются", () => {
    const merged = mergeClaimsByQuote([
      { ...raw({ quote: "первая" }), id: "claim9", source_file: "a.docx" },
      { ...raw({ quote: "вторая" }), id: "claim3", source_file: "b.docx" },
    ]);

    expect(merged.map((claim) => claim.id)).toEqual(["claim1", "claim2"]);
  });
});
