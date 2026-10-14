import { describe, expect, it } from "vitest";
import {
  formatYearMonth,
  fromMonths,
  monthsInclusive,
  naiveSum,
  parseYearMonth,
  toHalfOpen,
  toMonths,
  unionLength,
} from "./dates";

describe("toMonths / fromMonths", () => {
  it("roundtrip", () => {
    const ym = { year: 2026, month: 10 };
    expect(fromMonths(toMonths(ym))).toEqual(ym);
  });
});

describe("parseYearMonth / formatYearMonth", () => {
  it("parses valid", () => {
    expect(parseYearMonth("2005-07")).toEqual({ year: 2005, month: 7 });
  });

  it("rejects invalid format", () => {
    expect(() => parseYearMonth("2005/07")).toThrow();
  });

  it("rejects invalid month", () => {
    expect(() => parseYearMonth("2005-13")).toThrow();
  });

  it("formats with leading zero", () => {
    expect(formatYearMonth({ year: 2005, month: 7 })).toBe("2005-07");
  });
});

describe("monthsInclusive", () => {
  it("Test 1: 2003-10 -> 2005-07 = 22", () => {
    const n = monthsInclusive({ year: 2003, month: 10 }, { year: 2005, month: 7 });
    expect(n).toBe(22);
  });

  it("Test 2: 2005-07 -> 2018-12 = 162", () => {
    const n = monthsInclusive({ year: 2005, month: 7 }, { year: 2018, month: 12 });
    expect(n).toBe(162);
  });

  it("single month = 1", () => {
    const n = monthsInclusive({ year: 2026, month: 10 }, { year: 2026, month: 10 });
    expect(n).toBe(1);
  });

  it("end before start = 0", () => {
    const n = monthsInclusive({ year: 2026, month: 10 }, { year: 2026, month: 5 });
    expect(n).toBe(0);
  });
});

describe("naiveSum vs unionLength", () => {
  it("Test 5: смежность [2003-10..2005-07] + [2005-07..2018-12]", () => {
    const intervals = [
      { start: { year: 2003, month: 10 }, end: { year: 2005, month: 7 } },
      { start: { year: 2005, month: 7 }, end: { year: 2018, month: 12 } },
    ];

    // Наивная сумма: 22 + 162 = 184
    expect(naiveSum(intervals)).toBe(184);

    // Объединение: 2003-10 -> 2018-12 = 183 (стык 2005-07 не считается дважды)
    expect(unionLength(intervals.map(toHalfOpen))).toBe(183);
  });

  it("разрыв между интервалами суммируется полностью", () => {
    const intervals = [
      { start: { year: 2020, month: 1 }, end: { year: 2020, month: 6 } },
      { start: { year: 2021, month: 1 }, end: { year: 2021, month: 6 } },
    ];

    // Без стыка: сумма = union
    expect(naiveSum(intervals)).toBe(12);
    expect(unionLength(intervals.map(toHalfOpen))).toBe(12);
  });

  it("полное перекрытие: union = длина большего", () => {
    const intervals = [
      { start: { year: 2020, month: 1 }, end: { year: 2020, month: 12 } },
      { start: { year: 2020, month: 3 }, end: { year: 2020, month: 8 } },
    ];

    expect(naiveSum(intervals)).toBe(18);
    expect(unionLength(intervals.map(toHalfOpen))).toBe(12);
  });

  it("пустой массив = 0", () => {
    expect(naiveSum([])).toBe(0);
    expect(unionLength([])).toBe(0);
  });
});
