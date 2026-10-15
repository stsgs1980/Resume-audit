import { describe, expect, it } from "vitest";
import type { Claim } from "../stage2/types";
import { generateCurrencyQuestions, generateEvidenceQuestions, generateTargetVsMeasured } from "./question-generator";

const claim = (overrides: Partial<Claim> = {}): Claim => ({
  id: "claim1",
  statement: "выручка 4,2 млн руб.",
  quote: "выручка 4,2 млн руб.",
  source_file: "a.docx",
  category: "result",
  metric_type: "выручка",
  number: 4200000,
  currency: "RUB",
  status: "confirmed",
  reason: "",
  ...overrides,
});

describe("generateCurrencyQuestions()", () => {
  it("number без currency -> currency_missing", () => {
    const result = generateCurrencyQuestions([claim({ currency: null })]);

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("currency_missing");
  });

  it("number с currency -> нет вопросов", () => {
    expect(generateCurrencyQuestions([claim()])).toEqual([]);
  });
});

describe("generateEvidenceQuestions()", () => {
  it("needs_evidence -> missing_evidence", () => {
    const result = generateEvidenceQuestions([claim({ status: "needs_evidence" })]);

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("missing_evidence");
  });
});

describe("generateTargetVsMeasured()", () => {
  it("достигнет 6 млн -> target_vs_measured", () => {
    const result = generateTargetVsMeasured([
      claim({ statement: "выручка достигнет 6 млн", quote: "выручка достигнет 6 млн" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("target_vs_measured");
  });

  it("без маркеров прогноза -> нет вопросов", () => {
    expect(generateTargetVsMeasured([claim()])).toEqual([]);
  });
});
