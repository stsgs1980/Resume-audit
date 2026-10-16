import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { factsSchema } from "../../schemas/facts";
import type { Claim } from "../stage2/types";
import { runStage4a } from "./index";
import type { Stage4aParams } from "./types";

let dir = "";

const claim = (overrides: Partial<Claim> = {}): Claim => ({
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

const params = (): Stage4aParams => ({
  claimsPath: join(dir, "claims.json"),
  factsPath: join(dir, "facts.json"),
  auditPath: join(dir, "audit.json"),
  rolesConfigPath: "config/roles/sales.json",
  auditDate: "2026-10-09",
  geography: "Москва",
  candidateName: "Иван",
});

const writeClaims = (claims: Claim[]) => writeFile(join(dir, "claims.json"), JSON.stringify({ claims }), "utf8");

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage4-run-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runStage4a()", () => {
  it("пустой claims.json -> пустой facts со всеми полями", async () => {
    await writeClaims([]);

    const result = await runStage4a(params());

    expect(result.facts.jobs).toEqual([]);
    expect(result.facts.education).toEqual([]);
    expect(result.facts.languages).toEqual([]);
    expect(result.facts.confirmed_skills).toEqual([]);
    expect(result.facts.portfolio_projects).toEqual([]);
    expect(factsSchema.safeParse(result.facts).success).toBe(true);
  });

  it("смешанный набор -> jobs, education, languages, skills", async () => {
    await writeClaims([
      claim(),
      claim({ id: "claim2", category: "education", statement: "МГУ" }),
      claim({ id: "claim3", category: "language", statement: "Английский" }),
      claim({ id: "claim4", category: "skill", statement: "SQL" }),
      claim({
        id: "claim5",
        category: "result",
        statement: "выручка в компании Ромашка выросла",
        quote: "выручка выросла",
        metric_type: "выручка",
        number: 1,
        currency: null,
      }),
    ]);

    const result = await runStage4a(params());

    expect(result.facts.jobs).toHaveLength(1);
    expect(result.facts.education).toHaveLength(1);
    expect(result.facts.languages).toHaveLength(1);
    expect(result.facts.confirmed_skills).toHaveLength(1);
    expect(result.facts.jobs[0]?.results).toHaveLength(1);
    expect(factsSchema.safeParse(result.facts).success).toBe(true);
  });

  it("facts.json записан атомарно", async () => {
    await writeClaims([claim()]);

    const result = await runStage4a(params());
    const stored = JSON.parse(await readFile(join(dir, "facts.json"), "utf8")) as {
      jobs: unknown[];
    };

    expect(stored.jobs).toHaveLength(result.facts.jobs.length);
  });

  it("meta.targets заполнены из config", async () => {
    await writeClaims([]);

    const result = await runStage4a(params());

    expect(result.facts.meta.targets).toEqual([
      { id: "sales", title: "Руководитель отдела продаж", share_of_applications: 0.7 },
      { id: "salesops", title: "Руководитель Sales Operations", share_of_applications: 0.25 },
      { id: "aipo", title: "AI Product Owner", share_of_applications: 0.05 },
    ]);
    expect(result.facts.meta.audit_date).toBe("2026-10-09");
  });
});
