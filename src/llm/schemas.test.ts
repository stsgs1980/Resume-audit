import { describe, expect, it } from "vitest";
import {
  extractionResponseSchema,
  resumeResponseSchema,
  rolesResponseSchema,
  verificationResponseSchema,
} from "./schemas";

const minimalExtraction = {
  claims: [
    {
      statement: "рост выручки",
      quote: "выручка выросла",
      source_file: "resume.docx",
      category: "result",
      metric_type: "выручка",
      number: 4200000,
      currency: "RUB",
      status: "confirmed",
      reason: "",
    },
  ],
};

const minimalRoles = {
  roles: [
    {
      role_id: "sales",
      scores: {
        experience_fit: 8,
        responsibility_level: 7,
        measurable_results: 9,
        keyword_fit: 6,
        hr_screen: 7,
        hiring_manager: 8,
      },
      total: 45,
      strengths: ["опыт"],
      gaps: ["ats"],
      overpositioning_risk: 2,
      recommendation: "подходит",
    },
  ],
};

const minimalResume = {
  title: "Руководитель отдела продаж",
  specialization: "sales",
  employment_type: "full",
  work_format: "office",
  experience_total: "10 лет",
  experience_as_of: "2026-10-09",
  about: "Опытный руководитель.",
  jobs: [],
  skills: [],
  languages: ["Русский"],
};

const minimalVerification = {
  checks: [],
  unsupported_skills: [],
  forbidden_words_found: [],
};

describe("extractionResponseSchema", () => {
  it("принимает минимально-валидный объект", () => {
    expect(extractionResponseSchema.safeParse(minimalExtraction).success).toBe(true);
  });

  it("отклоняет пустую quote", () => {
    const bad = {
      claims: [{ ...minimalExtraction.claims[0], quote: "" }],
    };

    expect(extractionResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("отклоняет неверный category", () => {
    const bad = {
      claims: [{ ...minimalExtraction.claims[0], category: "unknown" }],
    };

    expect(extractionResponseSchema.safeParse(bad).success).toBe(false);
  });
});

describe("rolesResponseSchema", () => {
  it("принимает минимально-валидный объект", () => {
    expect(rolesResponseSchema.safeParse(minimalRoles).success).toBe(true);
  });

  it("отклоняет score 11", () => {
    const bad = {
      roles: [{ ...minimalRoles.roles[0], scores: { ...minimalRoles.roles[0].scores, hr_screen: 11 } }],
    };

    expect(rolesResponseSchema.safeParse(bad).success).toBe(false);
  });
});

describe("resumeResponseSchema", () => {
  it("принимает минимально-валидный объект", () => {
    expect(resumeResponseSchema.safeParse(minimalResume).success).toBe(true);
  });

  it("отклоняет результат без fact_id", () => {
    const bad = {
      ...minimalResume,
      jobs: [
        {
          job_id: "job1",
          company: "A",
          industry: "",
          position: "P",
          period: "2020-01 - 2021-01",
          duration: "13 мес.",
          context: "",
          actions: [],
          results: [{ text: "рост", fact_id: "", hedge_present: false }],
          total_experience_inconsistent: false,
          total_experience_note: "",
        },
      ],
    };

    expect(resumeResponseSchema.safeParse(bad).success).toBe(false);
  });
});

describe("verificationResponseSchema", () => {
  it("принимает минимально-валидный объект", () => {
    expect(verificationResponseSchema.safeParse(minimalVerification).success).toBe(true);
  });

  it("отклоняет неверный verdict", () => {
    const bad = {
      ...minimalVerification,
      checks: [
        {
          number: "4,2 млн",
          claim: "рост",
          matches_fact: true,
          fact_id: "res1",
          matches_role: true,
          has_hedge: false,
          verdict: "unknown",
          comment: "",
        },
      ],
    };

    expect(verificationResponseSchema.safeParse(bad).success).toBe(false);
  });
});
