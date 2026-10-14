import { describe, expect, it } from "vitest";
import type { JobInterval } from "./experience";
import {
  computeExperience,
  findGaps,
  findOverlaps,
  formatExperience,
  resolveJobEnd,
  resolvePresent,
} from "./experience";

describe("resolvePresent", () => {
  it("Test 6: audit_date = 2026-09-09 -> present = 2026-08", () => {
    // Сентябрь 2026 ещё не завершён на 9 сентября. Последний завершённый — август.
    expect(resolvePresent("2026-09-09")).toEqual({ year: 2026, month: 8 });
  });

  it("audit_date = 2026-10-09 -> present = 2026-09", () => {
    expect(resolvePresent("2026-10-09")).toEqual({ year: 2026, month: 9 });
  });

  it("january -> previous year december", () => {
    expect(resolvePresent("2026-01-15")).toEqual({ year: 2025, month: 12 });
  });

  it("rejects invalid format", () => {
    expect(() => resolvePresent("2026-09")).toThrow();
  });
});

describe("resolveJobEnd", () => {
  it("present подставляется для isCurrent", () => {
    const job: JobInterval = {
      id: "job1",
      start: { year: 2025, month: 10 },
      end: null,
      isCurrent: true,
      overlapGroup: null,
    };

    const resolved = resolveJobEnd(job, { year: 2026, month: 9 });
    expect(resolved.end).toEqual({ year: 2026, month: 9 });
  });

  it("стаж 2025-10 -> present (2026-09) = 12 месяцев", () => {
    const job: JobInterval = {
      id: "job1",
      start: { year: 2025, month: 10 },
      end: null,
      isCurrent: true,
      overlapGroup: null,
    };

    const resolved = resolveJobEnd(job, { year: 2026, month: 9 });
    const experience = computeExperience([resolved]);

    expect(experience.naive).toBe(12);
    expect(experience.distinct).toBe(12);
  });

  it("throws если isCurrent=false и end=null", () => {
    const job: JobInterval = {
      id: "job1",
      start: { year: 2025, month: 10 },
      end: null,
      isCurrent: false,
      overlapGroup: null,
    };

    expect(() => resolveJobEnd(job, { year: 2026, month: 9 })).toThrow();
  });
});

describe("Test 7: баг hh.ru 2025-10 -> present при audit_date = 2026-10-09", () => {
  it("истина = 12 месяцев, не 13", () => {
    const job: JobInterval = {
      id: "job1",
      start: { year: 2025, month: 10 },
      end: null,
      isCurrent: true,
      overlapGroup: null,
    };

    const present = resolvePresent("2026-10-09");
    const resolved = resolveJobEnd(job, present);
    const experience = computeExperience([resolved]);

    // present = 2026-09, включительно: 2025-10 -> 2026-09 = 12 месяцев
    expect(experience.naive).toBe(12);
    expect(experience.distinct).toBe(12);
  });
});

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

describe("computeExperience", () => {
  it("Test 5: смежность даёт разницу в 1 месяц", () => {
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

    const result = computeExperience(intervals);
    expect(result.naive).toBe(184);
    expect(result.distinct).toBe(183);
    expect(result.difference).toBe(1);
  });

  it("без стыка naive = distinct", () => {
    const intervals = [
      {
        id: "job1",
        start: { year: 2020, month: 1 },
        end: { year: 2020, month: 6 },
        overlapGroup: null,
      },
      {
        id: "job2",
        start: { year: 2021, month: 1 },
        end: { year: 2021, month: 6 },
        overlapGroup: null,
      },
    ];

    const result = computeExperience(intervals);
    expect(result.naive).toBe(12);
    expect(result.distinct).toBe(12);
    expect(result.difference).toBe(0);
  });
});

describe("formatExperience", () => {
  it("21 год 10 месяцев", () => {
    expect(formatExperience(262)).toBe("21 год 10 месяцев");
  });

  it("21 год 9 месяцев", () => {
    expect(formatExperience(261)).toBe("21 год 9 месяцев");
  });

  it("1 год 0 месяцев", () => {
    expect(formatExperience(12)).toBe("1 год 0 месяцев");
  });

  it("0 лет 5 месяцев", () => {
    expect(formatExperience(5)).toBe("0 лет 5 месяцев");
  });

  it("2 года 3 месяца", () => {
    expect(formatExperience(27)).toBe("2 года 3 месяца");
  });
});
