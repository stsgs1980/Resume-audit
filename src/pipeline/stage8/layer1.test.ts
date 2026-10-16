import { describe, expect, it } from "vitest";
import type { ResumeResponse } from "../../llm/schemas";
import type { Facts } from "../../schemas/facts";
import { verifyLayer1 } from "./layer1";

const ROLES_CONFIG = "config/roles/sales.json";

/**
 * Факты слоя 1 с переопределениями.
 *
 * @param overrides - переопределяемые поля
 * @returns факты
 */
const makeFacts = (overrides: Record<string, unknown> = {}): Facts => {
  return {
    schema_version: 1,
    meta: {
      candidate_name: "",
      audit_date: "2026-10-09",
      geography: "",
      targets: [
        { id: "sales", title: "", share_of_applications: 0.7 },
        { id: "salesops", title: "", share_of_applications: 0.25 },
        { id: "aipo", title: "", share_of_applications: 0.05 },
      ],
    },
    jobs: [
      {
        id: "job1",
        company: "Ромашка",
        position: "Руководитель",
        start: "2020-01",
        end: "2021-01",
        is_current: false,
        results: [
          {
            id: "res1",
            key: "",
            text: "выручка",
            number: 4200000,
            unit: "",
            currency: null,
            status: "confirmed",
            roles: ["sales"],
            evidence_id: "res1",
            hedge_required: false,
          },
        ],
      },
    ],
    education: [],
    languages: [],
    confirmed_skills: [{ id: "s1", skill: "SQL", roles: ["sales"] }],
    portfolio_projects: [],
    ...overrides,
  } as unknown as Facts;
};

/**
 * Резюме слоя 1 с переопределениями.
 *
 * @param overrides - переопределяемые поля
 * @returns резюме
 */
const makeResume = (overrides: Record<string, unknown> = {}): ResumeResponse => {
  return {
    title: "Руководитель отдела продаж",
    specialization: "sales",
    employment_type: "full",
    work_format: "office",
    experience_total: "10 лет",
    experience_as_of: "2026-10-09",
    about: "Опыт управления командой.",
    jobs: [
      {
        job_id: "job1",
        company: "Ромашка",
        industry: "",
        position: "Руководитель",
        period: "2020-01 - 2021-01",
        duration: "",
        context: "",
        actions: [],
        results: [{ text: "выручка 4,2 млн", fact_id: "res1", hedge_present: true }],
        total_experience_inconsistent: false,
        total_experience_note: "",
      },
    ],
    skills: [{ skill: "SQL", skill_id: "s1" }],
    languages: ["Английский"],
    ...overrides,
  } as unknown as ResumeResponse;
};

describe("verifyLayer1()", () => {
  it("навык из confirmed_skills -> ok", () => {
    expect(verifyLayer1(makeResume(), makeFacts(), "sales", ROLES_CONFIG).skillErrors).toEqual([]);
  });

  it("навык вне confirmed -> skillErrors", () => {
    const resume = makeResume({ skills: [{ skill: "Go", skill_id: "g1" }] });

    expect(verifyLayer1(resume, makeFacts(), "sales", ROLES_CONFIG).skillErrors).toContain("Go");
  });

  it("forbidden word production -> forbiddenFound", () => {
    const resume = makeResume({ about: "Внедрил production систему" });

    expect(verifyLayer1(resume, makeFacts(), "sales", ROLES_CONFIG).forbiddenFound).toContain("production");
  });

  it("плейсхолдер +7 (XXX) -> placeholdersFound", () => {
    const resume = makeResume({ about: "Звоните +7 (XXX) 000-00-00" });

    expect(verifyLayer1(resume, makeFacts(), "sales", ROLES_CONFIG).placeholdersFound.length).toBeGreaterThan(0);
  });

  it("title со слэшем -> titleOk false", () => {
    const resume = makeResume({ title: "Руководитель / Продажи" });

    expect(verifyLayer1(resume, makeFacts(), "sales", ROLES_CONFIG).titleOk).toBe(false);
  });

  it("пустое поле about -> requiredFieldsMissing", () => {
    const resume = makeResume({ about: "" });

    expect(verifyLayer1(resume, makeFacts(), "sales", ROLES_CONFIG).requiredFieldsMissing).toContain("about");
  });

  it("hedge_required без hedge_present -> hedgeErrors", () => {
    const facts = makeFacts();

    (facts.jobs[0]?.results?.[0] as unknown as Record<string, unknown>)["hedge_required"] = true;

    const resume = makeResume();

    (resume.jobs[0]?.results[0] as unknown as Record<string, unknown>)["hedge_present"] = false;

    expect(verifyLayer1(resume, facts, "sales", ROLES_CONFIG).hedgeErrors).toContain("res1");
  });

  it("sum shares 1.05 -> shareSumOk false", () => {
    const facts = makeFacts({
      meta: {
        candidate_name: "",
        audit_date: "2026-10-09",
        geography: "",
        targets: [
          { id: "sales", title: "", share_of_applications: 0.7 },
          { id: "salesops", title: "", share_of_applications: 0.35 },
        ],
      },
    });

    expect(verifyLayer1(makeResume(), facts, "sales", ROLES_CONFIG).shareSumOk).toBe(false);
  });

  it("happy path -> всё чисто", () => {
    const layer1 = verifyLayer1(makeResume(), makeFacts(), "sales", ROLES_CONFIG);

    expect(layer1.numberErrors).toEqual([]);
    expect(layer1.skillErrors).toEqual([]);
    expect(layer1.forbiddenFound).toEqual([]);
    expect(layer1.placeholdersFound).toEqual([]);
    expect(layer1.titleOk).toBe(true);
    expect(layer1.requiredFieldsMissing).toEqual([]);
    expect(layer1.hedgeErrors).toEqual([]);
    expect(layer1.targetMetricsInResults).toEqual([]);
    expect(layer1.shareSumOk).toBe(true);
  });

  it("число из target_metrics в results -> targetMetricsInResults", () => {
    const facts = makeFacts({
      portfolio_projects: [{ id: "p1", title: "Пет-проект", target_metrics: [{ number: 5000000 }] }],
    });
    const resume = makeResume();

    (resume.jobs[0]?.results[0] as unknown as Record<string, unknown>)["text"] = "выручка 5 млн";

    expect(verifyLayer1(resume, facts, "sales", ROLES_CONFIG).targetMetricsInResults.length).toBeGreaterThan(0);
  });
});
