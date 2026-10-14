import { describe, expect, it } from "vitest";
import { findGaps, findOverlaps } from "./interval-analysis";

describe("findGaps", () => {
  it("Test 9: разрыв ровно 3 месяца — не флаг", () => {
    const intervals = [
      {
        id: "job1",
        start: { year: 2020, month: 1 },
        end: { year: 2020, month: 6 },
        overlapGroup: null,
      },
      {
        id: "job2",
        start: { year: 2020, month: 10 },
        end: { year: 2021, month: 6 },
        overlapGroup: null,
      },
    ];

    // 2020-06 -> 2020-10: 7, 8, 9 = 3 месяца разрыва
    expect(findGaps(intervals, 3)).toEqual([]);
  });

  it("разрыв 4 месяца — флаг", () => {
    const intervals = [
      {
        id: "job1",
        start: { year: 2020, month: 1 },
        end: { year: 2020, month: 6 },
        overlapGroup: null,
      },
      {
        id: "job2",
        start: { year: 2020, month: 11 },
        end: { year: 2021, month: 6 },
        overlapGroup: null,
      },
    ];

    const gaps = findGaps(intervals, 3);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.months).toBe(4);
  });

  it("стык (prev.end == next.start) — не разрыв", () => {
    const intervals = [
      {
        id: "job1",
        start: { year: 2003, month: 10 },
        end: { year: 2005, month: 7 },
        overlapGroup: null,
      },
      {
        id: "job2",
        start: { year: 2005, month: 7 },
        end: { year: 2018, month: 12 },
        overlapGroup: null,
      },
    ];

    expect(findGaps(intervals, 3)).toEqual([]);
  });

  it("вложенный интервал не создаёт ложный разрыв — один gap 5 мес", () => {
    const intervals = [
      {
        id: "jobA",
        start: { year: 2020, month: 1 },
        end: { year: 2021, month: 12 },
        overlapGroup: null,
      },
      {
        id: "jobB",
        start: { year: 2020, month: 6 },
        end: { year: 2020, month: 12 },
        overlapGroup: null,
      },
      {
        id: "jobC",
        start: { year: 2022, month: 6 },
        end: { year: 2023, month: 1 },
        overlapGroup: null,
      },
    ];

    const gaps = findGaps(intervals, 3);

    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.months).toBe(5);
  });
});

describe("findOverlaps", () => {
  it("Test 10: пересечение с разными overlapGroup — флаг", () => {
    const intervals = [
      {
        id: "job1",
        start: { year: 2020, month: 1 },
        end: { year: 2020, month: 12 },
        overlapGroup: "A",
      },
      {
        id: "job2",
        start: { year: 2020, month: 6 },
        end: { year: 2021, month: 6 },
        overlapGroup: "B",
      },
    ];

    const overlaps = findOverlaps(intervals);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]?.months).toBe(7);
  });

  it("пересечение с одинаковым overlapGroup — не флаг", () => {
    const intervals = [
      {
        id: "job1",
        start: { year: 2020, month: 1 },
        end: { year: 2020, month: 12 },
        overlapGroup: "A",
      },
      {
        id: "job2",
        start: { year: 2020, month: 6 },
        end: { year: 2021, month: 6 },
        overlapGroup: "A",
      },
    ];

    expect(findOverlaps(intervals)).toEqual([]);
  });

  it("стык — не пересечение", () => {
    const intervals = [
      {
        id: "job1",
        start: { year: 2003, month: 10 },
        end: { year: 2005, month: 7 },
        overlapGroup: "A",
      },
      {
        id: "job2",
        start: { year: 2005, month: 7 },
        end: { year: 2018, month: 12 },
        overlapGroup: "B",
      },
    ];

    // Смежность: конец первого (2005-07) совпадает с началом второго (2005-07).
    // По конвенции SPEC-dates это НЕ пересечение.
    expect(findOverlaps(intervals)).toEqual([]);
  });
});
