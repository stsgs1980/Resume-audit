import { describe, expect, it } from "vitest";
import { factsSchema } from "./facts";

const minimalFacts = {
  schema_version: 1,
  meta: {
    candidate_name: "",
    audit_date: "2026-10-09",
    geography: "",
    targets: [{ id: "sales", title: "", share_of_applications: 0.7 }],
  },
  jobs: [],
  education: [],
  languages: [],
  confirmed_skills: [],
  portfolio_projects: [],
};

const baseJob = {
  id: "job1",
  company: "Компания А",
  position: "Руководитель",
  start: "2020-01",
  end: "2021-01",
  is_current: false,
};

/**
 * Собирает facts с одной job-записью для негативных тестов.
 *
 * @param job - job-запись для подстановки в facts
 * @returns facts с одной job
 */
function factsWithJob(job: Record<string, unknown>) {
  return { ...minimalFacts, jobs: [job] };
}

describe("factsSchema strict dates", () => {
  it('rejects month 13 in start ("2026-13")', () => {
    expect(factsSchema.safeParse(factsWithJob({ ...baseJob, start: "2026-13" })).success).toBe(false);
  });

  it('rejects month 00 in start ("2026-00")', () => {
    expect(factsSchema.safeParse(factsWithJob({ ...baseJob, start: "2026-00" })).success).toBe(false);
  });

  it('accepts valid start ("2026-01")', () => {
    const job = { ...baseJob, start: "2026-01", end: "2026-05" };

    expect(factsSchema.safeParse(factsWithJob(job)).success).toBe(true);
  });
});

describe("job consistency (is_current/end)", () => {
  it("rejects is_current: true with end set", () => {
    const job = { ...baseJob, is_current: true, end: "2025-01" };

    expect(factsSchema.safeParse(factsWithJob(job)).success).toBe(false);
  });

  it("rejects is_current: false with end null", () => {
    const job = { ...baseJob, is_current: false, end: null };

    expect(factsSchema.safeParse(factsWithJob(job)).success).toBe(false);
  });

  it("rejects start after end", () => {
    const job = { ...baseJob, start: "2026-01", end: "2025-01" };

    expect(factsSchema.safeParse(factsWithJob(job)).success).toBe(false);
  });

  it("accepts is_current: true without end", () => {
    const job: Record<string, unknown> = { ...baseJob, is_current: true };

    delete job["end"];

    expect(factsSchema.safeParse(factsWithJob(job)).success).toBe(true);
  });

  it("accepts is_current: false with end set", () => {
    const job = { ...baseJob, is_current: false, end: "2025-12" };

    expect(factsSchema.safeParse(factsWithJob(job)).success).toBe(true);
  });
});
