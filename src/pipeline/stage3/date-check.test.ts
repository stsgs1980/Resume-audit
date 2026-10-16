import { describe, expect, it } from "vitest";
import type { Claim } from "../stage2/types";
import { detectDateContradictions, detectDurationMismatch, detectGaps } from "./date-check";

const employment = (overrides: Partial<Claim> = {}): Claim => ({
  id: "claim1",
  statement: "работал",
  quote: "работал",
  source_file: "a.docx",
  category: "employment",
  metric_type: "",
  number: null,
  currency: null,
  status: "confirmed",
  reason: "",
  ...overrides,
});

describe("detectDateContradictions()", () => {
  it("разные даты одной компании -> warning", () => {
    const result = detectDateContradictions([
      employment({
        statement: "ООО Ромашка руководитель",
        quote: "работал в ООО Ромашка с 2020-01 по 2021-01",
      }),
      employment({
        id: "claim2",
        statement: "ООО Ромашка директор",
        quote: "работал в ООО Ромашка с 2021-03 по 2022-01",
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.severity).toBe("warning");
  });

  it("одинаковые даты -> нет противоречий", () => {
    const result = detectDateContradictions([
      employment({ quote: "работал в компании Ромашка с 2020-01 по 2021-01" }),
      employment({ id: "claim2", quote: "работал в компании Ромашка с 2020-01 по 2021-01" }),
    ]);

    expect(result).toEqual([]);
  });

  it("две компании с разными датами -> нет contradictions (общие слова не считаются)", () => {
    const result = detectDateContradictions([
      employment({
        statement: "работал руководителем отдела продаж в компании Ромашка",
        quote: "работал в компании Ромашка с 2020-01 по 2021-01",
      }),
      employment({
        id: "claim2",
        statement: "работал руководителем отдела продаж в компании Лютик",
        quote: "работал в компании Лютик с 2022-01 по 2023-01",
      }),
    ]);

    expect(result).toEqual([]);
  });

  it("компании не извлечены -> нет contradictions", () => {
    const result = detectDateContradictions([
      employment({
        statement: "работал руководителем отдела продаж в компании А",
        quote: "работал с 2020-01 по 2021-01",
      }),
      employment({
        id: "claim2",
        statement: "работал руководителем отдела продаж в компании Б",
        quote: "работал с 2022-01 по 2023-01",
      }),
    ]);

    expect(result).toEqual([]);
  });

  it("без контекста компании -> нет contradictions (только общие слова)", () => {
    const result = detectDateContradictions([
      employment({
        statement: "работал руководителем отдела продаж",
        quote: "работал с 2020-01 по 2021-01",
      }),
      employment({
        id: "claim2",
        statement: "работал руководителем отдела продаж",
        quote: "работал с 2022-01 по 2023-01",
      }),
    ]);

    expect(result).toEqual([]);
  });
});

describe("detectDurationMismatch()", () => {
  it("13 месяцев против расчётных 12 -> hard", () => {
    const result = detectDurationMismatch(
      [employment({ quote: "работал 2020-01 - 2020-12, всего 13 месяцев" })],
      "2026-10-09",
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.severity).toBe("hard");
  });

  it("совпадение длительности -> нет противоречий", () => {
    const result = detectDurationMismatch(
      [employment({ quote: "работал 2020-01 - 2020-12, всего 12 месяцев" })],
      "2026-10-09",
    );

    expect(result).toEqual([]);
  });
});

describe("detectGaps()", () => {
  it("разрыв 5 месяцев -> OpenQuestion gap", () => {
    const result = detectGaps([
      employment({ quote: "работал 2020-01 - 2020-06" }),
      employment({ id: "claim2", quote: "работал 2020-12 - 2021-06" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("gap");
  });

  it("разрыв 2 месяца -> нет вопроса", () => {
    const result = detectGaps([
      employment({ quote: "работал 2020-01 - 2020-06" }),
      employment({ id: "claim2", quote: "работал 2020-09 - 2021-06" }),
    ]);

    expect(result).toEqual([]);
  });
});
