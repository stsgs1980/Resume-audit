import { describe, expect, it } from "vitest";
import type { ResumeResponse } from "../../llm/schemas";
import type { Facts } from "../../schemas/facts";
import { validateFactIds, validateHedge } from "./postprocess";

const facts = {
  jobs: [
    {
      results: [
        { id: "res1", evidence_id: "res1", hedge_required: true },
        { id: "res2", evidence_id: "res2", hedge_required: false },
      ],
    },
  ],
} as unknown as Facts;

const resume = (results: Array<{ fact_id: string; hedge_present: boolean }>): ResumeResponse =>
  ({
    title: "",
    specialization: "",
    employment_type: "",
    work_format: "",
    experience_total: "",
    experience_as_of: "",
    about: "",
    jobs: [
      {
        job_id: "",
        company: "",
        industry: "",
        position: "",
        period: "",
        duration: "",
        context: "",
        actions: [],
        results: results.map((entry) => ({ text: "", ...entry })),
        total_experience_inconsistent: false,
        total_experience_note: "",
      },
    ],
    skills: [],
    languages: [],
  }) as ResumeResponse;

describe("validateFactIds()", () => {
  it("неизвестный fact_id -> в списке ошибок", () => {
    expect(validateFactIds(resume([{ fact_id: "nope", hedge_present: false }]), facts)).toEqual(["nope"]);
  });

  it("все известные -> пусто", () => {
    expect(validateFactIds(resume([{ fact_id: "res1", hedge_present: true }]), facts)).toEqual([]);
  });
});

describe("validateHedge()", () => {
  it("hedge_required без hedge_present -> в списке", () => {
    expect(validateHedge(resume([{ fact_id: "res1", hedge_present: false }]), facts)).toEqual(["res1"]);
  });

  it("hedge_present true -> пусто", () => {
    expect(validateHedge(resume([{ fact_id: "res1", hedge_present: true }]), facts)).toEqual([]);
  });
});
