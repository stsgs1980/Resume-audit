import { describe, expect, it } from "vitest";
import { claimSchema, claimsSchema } from "./claims";

const baseClaim = {
  id: "claim1",
  statement: "рост выручки на 4,2 млн",
  quote: "цитата из файла",
  source_file: "resume.docx",
  category: "result",
  metric_type: "выручка",
  number: 4200000,
  currency: "RUB",
  status: "confirmed",
  reason: "",
};

/**
 * Возвращает claim без указанного поля для негативного теста схемы.
 *
 * @param field - имя удаляемого поля
 * @returns копия claim без поля
 */
function withoutField(field: keyof typeof baseClaim): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...baseClaim };

  delete copy[field];

  return copy;
}

describe("claimsSchema strictness", () => {
  it("rejects claim without metric_type", () => {
    expect(claimsSchema.safeParse({ claims: [withoutField("metric_type")] }).success).toBe(false);
  });

  it("rejects claim without number", () => {
    expect(claimsSchema.safeParse({ claims: [withoutField("number")] }).success).toBe(false);
  });

  it("rejects claim without currency", () => {
    expect(claimsSchema.safeParse({ claims: [withoutField("currency")] }).success).toBe(false);
  });

  it("rejects claim without reason", () => {
    expect(claimsSchema.safeParse({ claims: [withoutField("reason")] }).success).toBe(false);
  });

  it("rejects empty statement", () => {
    expect(claimsSchema.safeParse({ claims: [{ ...baseClaim, statement: "" }] }).success).toBe(false);
  });

  it("rejects empty quote", () => {
    expect(claimsSchema.safeParse({ claims: [{ ...baseClaim, quote: "" }] }).success).toBe(false);
  });

  it("accepts null number and currency", () => {
    expect(claimsSchema.safeParse({ claims: [{ ...baseClaim, number: null, currency: null }] }).success).toBe(true);
  });

  it("claimSchema accepts the same claim directly", () => {
    expect(claimSchema.safeParse(baseClaim).success).toBe(true);
  });
});
