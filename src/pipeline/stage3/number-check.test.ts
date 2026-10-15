import { describe, expect, it } from "vitest";
import type { Claim } from "../stage2/types";
import { crossCheckClaims } from "./number-check";

const claim = (overrides: Partial<Claim> = {}): Claim => ({
  id: "claim1",
  statement: "выручка 4,2 млн",
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

describe("crossCheckClaims()", () => {
  it("одинаковые числа -> 0 contradictions", () => {
    expect(crossCheckClaims([claim(), claim({ id: "claim2" })])).toEqual([]);
  });

  it("расхождение 3% -> hard", () => {
    const result = crossCheckClaims([
      claim({ number: 100, statement: "выручка 100" }),
      claim({ id: "claim2", number: 103, statement: "выручка 103" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.severity).toBe("hard");
  });

  it("~4 млн против 4,2 млн -> warning про округление", () => {
    const result = crossCheckClaims([
      claim({ number: 4000000, statement: "~4 млн" }),
      claim({ id: "claim2", number: 4200000, statement: "4,2 млн" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.severity).toBe("warning");
    expect(result[0]?.description).toContain("округление");
  });

  it("три claims, одна расходится -> 1 contradiction", () => {
    const result = crossCheckClaims([
      claim({ number: 100 }),
      claim({ id: "claim2", number: 100 }),
      claim({ id: "claim3", number: 110 }),
    ]);

    expect(result).toHaveLength(1);
  });

  it("разные метрики не сравниваются", () => {
    const result = crossCheckClaims([
      claim({ number: 100, metric_type: "выручка" }),
      claim({ id: "claim2", number: 200, metric_type: "команда" }),
    ]);

    expect(result).toEqual([]);
  });
});
