import { describe, expect, it } from "vitest";
import type { ParsedNumber } from "./numbers";
import { crossCheckNumbers, detectCurrency, parseNumber } from "./numbers";

describe("Test 11: миллионы в трёх записях", () => {
  it("4,2 млн -> 4 200 000, валюта null", () => {
    const parsed = parseNumber("выручка 4,2 млн");
    expect(parsed?.value).toBe(4_200_000);
    expect(parsed?.currency).toBeNull();
  });

  it("4.2 млн -> 4 200 000, валюта null", () => {
    const parsed = parseNumber("выручка 4.2 млн");
    expect(parsed?.value).toBe(4_200_000);
    expect(parsed?.currency).toBeNull();
  });

  it("4 200 000 -> 4 200 000, валюта null", () => {
    const parsed = parseNumber("выручка 4 200 000");
    expect(parsed?.value).toBe(4_200_000);
    expect(parsed?.currency).toBeNull();
  });

  it("$1,02 млн -> 1 020 000 USD", () => {
    const parsed = parseNumber("$1,02 млн");
    expect(parsed?.value).toBe(1_020_000);
    expect(parsed?.currency).toBe("USD");
  });

  it("45% -> 45, qualifier percent", () => {
    const parsed = parseNumber("конверсия 45%");
    expect(parsed?.value).toBe(45);
    expect(parsed?.qualifier).toBe("percent");
    expect(parsed?.currency).toBeNull();
  });
});

describe("Test 12: валюта из контекста", () => {
  it("$120 тыс. -> 120 000 USD", () => {
    const parsed = parseNumber("$120 тыс.");
    expect(parsed?.value).toBe(120_000);
    expect(parsed?.currency).toBe("USD");
  });

  it("120 тыс. -> 120 000, валюта null (флаг: валюта не указана)", () => {
    const parsed = parseNumber("бюджет 120 тыс.");
    expect(parsed?.value).toBe(120_000);
    // Флаг "валюта не указана": currency строго null, USD не подставляется.
    expect(parsed?.currency).toBeNull();
    expect(detectCurrency("бюджет 120 тыс.")).toBeNull();
  });
});

describe("Test 13: жёсткое расхождение", () => {
  it("4,2 млн vs 3,9 млн -> hard (расхождение >= 2%)", () => {
    const a: ParsedNumber = { value: 4_200_000, currency: null, qualifier: "exact" };
    const b: ParsedNumber = { value: 3_900_000, currency: null, qualifier: "exact" };
    const result = crossCheckNumbers(a, b);
    expect(result.severity).toBe("hard");
    expect(result.reason).toMatch(/жёсткое расхождение/);
  });

  it("через parseNumber: 4,2 млн vs 3,9 млн -> hard", () => {
    const a = parseNumber("4,2 млн");
    const b = parseNumber("3,9 млн");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();

    if (!a || !b) {
      return;
    }

    expect(crossCheckNumbers(a, b).severity).toBe("hard");
  });
});

describe("Test 14: возможно округление", () => {
  it("~4 млн vs 4,2 млн -> warning возможно округление", () => {
    const a = parseNumber("~4 млн");
    const b = parseNumber("4,2 млн");
    expect(a?.qualifier).toBe("approx");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();

    if (!a || !b) {
      return;
    }

    const result = crossCheckNumbers(a, b);
    expect(result.severity).toBe("warning");
    expect(result.reason).toMatch(/возможно округление/);
  });
});
