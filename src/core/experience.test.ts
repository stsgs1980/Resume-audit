import { describe, expect, it } from "vitest";
import type { JobInterval } from "./experience";
import { computeExperience, resolveJobEnd, resolvePresent } from "./experience";

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
