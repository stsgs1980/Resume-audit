import { describe, expect, it } from "vitest";
import type { Claim } from "../stage2/types";
import { buildJobs, buildResults } from "./build-jobs";

const employment = (overrides: Partial<Claim> = {}): Claim => ({
  id: "claim1",
  statement: "работал в компании Ромашка руководителем",
  quote: "работал в компании Ромашка с 2020-01 по 2021-01",
  source_file: "a.docx",
  category: "employment",
  metric_type: "",
  number: null,
  currency: null,
  status: "confirmed",
  reason: "",
  ...overrides,
});

const resultClaim = (overrides: Partial<Claim> = {}): Claim => ({
  id: "claim9",
  statement: "выручка в компании Ромашка выросла",
  quote: "выручка выросла на 4,2 млн руб.",
  source_file: "a.docx",
  category: "result",
  metric_type: "выручка",
  number: 4200000,
  currency: "RUB",
  status: "confirmed",
  reason: "",
  ...overrides,
});

const roles = ["sales", "salesops"];

describe("buildJobs()", () => {
  it("3 employment одной компании -> одна job", () => {
    const { jobs, warnings } = buildJobs(
      [employment(), employment({ id: "claim2" }), employment({ id: "claim3" })],
      roles,
    );

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.id).toBe("job1");
    expect(warnings).toEqual([]);
  });

  it("2 компании -> 2 jobs", () => {
    const { jobs } = buildJobs(
      [
        employment(),
        employment({
          id: "claim2",
          statement: "работал в компании Лютик",
          quote: "в компании Лютик с 2021-03 по 2022-01",
        }),
      ],
      roles,
    );

    expect(jobs).toHaveLength(2);
  });

  it("dates из цитат парсятся", () => {
    const { jobs } = buildJobs([employment()], roles);

    expect(jobs[0]).toMatchObject({ start: "2020-01", end: "2021-01", is_current: false });
  });

  it("голый год не становится датой: job не создаётся, warning", () => {
    const { jobs, warnings } = buildJobs([employment({ quote: "в компании Ромашка привлёк 2000 клиентов" })], roles);

    expect(jobs).toEqual([]);
    expect(warnings.some((warning) => warning.code === "no_dates")).toBe(true);
  });

  it("цитата с голым годом игнорируется, если есть полная дата", () => {
    const { jobs } = buildJobs(
      [employment(), employment({ id: "claim2", quote: "в компании Ромашка привлёк 2000 клиентов" })],
      roles,
    );

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ start: "2020-01", end: "2021-01" });
  });
});

describe("buildResults()", () => {
  it("results привязаны к правильным jobs", () => {
    const { jobs } = buildJobs([employment()], roles);
    const { jobs: withResults } = buildResults([resultClaim()], jobs, roles);

    expect(withResults[0]?.results).toHaveLength(1);
    expect(withResults[0]?.results?.[0]?.evidence_id).toBe(withResults[0]?.results?.[0]?.id);
  });

  it("number и currency заполнены", () => {
    const { jobs } = buildJobs([employment()], roles);
    const { jobs: withResults } = buildResults([resultClaim()], jobs, roles);
    const result = withResults[0]?.results?.[0];

    expect(result).toMatchObject({ number: 4200000, currency: "RUB", evidence_id: result?.id });
  });

  it("source_claim_id указывает на claim-источник", () => {
    const { jobs } = buildJobs([employment()], roles);
    const { jobs: withResults } = buildResults([resultClaim()], jobs, roles);
    const result = withResults[0]?.results?.[0];

    expect(result?.source_claim_id).toBe("claim9");
    expect(result?.evidence_id).toBe(result?.id);
  });

  it("result без привязки -> warning", () => {
    const { jobs } = buildJobs([employment()], roles);
    const { warnings } = buildResults(
      [resultClaim({ statement: "выручка выросла где-то", quote: "выручка выросла" })],
      jobs,
      roles,
    );

    expect(warnings.length).toBeGreaterThan(0);
  });

  it("detected_roles ограничивают roles результата", () => {
    const { jobs } = buildJobs([employment()], roles);
    const { jobs: withResults } = buildResults([resultClaim({ detected_roles: ["salesops"] })], jobs, roles);

    expect(withResults[0]?.results?.[0]?.roles).toEqual(["salesops"]);
  });

  it("без detected_roles -> все целевые роли", () => {
    const { jobs } = buildJobs([employment()], roles);
    const { jobs: withResults } = buildResults([resultClaim()], jobs, roles);

    expect(withResults[0]?.results?.[0]?.roles).toEqual(roles);
  });

  it("requires_hedge включает hedge_required", () => {
    const { jobs } = buildJobs([employment()], roles);
    const { jobs: withResults } = buildResults([resultClaim({ requires_hedge: true })], jobs, roles);

    expect(withResults[0]?.results?.[0]?.hedge_required).toBe(true);
  });

  it("без requires_hedge -> hedge_required false", () => {
    const { jobs } = buildJobs([employment()], roles);
    const { jobs: withResults } = buildResults([resultClaim()], jobs, roles);

    expect(withResults[0]?.results?.[0]?.hedge_required).toBe(false);
  });
});
