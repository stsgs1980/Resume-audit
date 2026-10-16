import { describe, expect, it } from "vitest";
import { auditSchema } from "./audit";
import { claimsSchema } from "./claims";
import { evidenceSchema } from "./evidence";
import { factsSchema } from "./facts";
import { stageStateSchema } from "./stage-state";
import { validationSchema } from "./validation";

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

const minimalEvidence = {
  fact_id: "res1",
  source_file: "resume_v2.docx",
  quote: "рост выручки на 4,2 млн руб. за 2023",
  metric_definition: "выручка по направлению X",
  period: "2023-01 - 2023-12",
  baseline: "выручка_2022 = 18,4 млн",
  source_of_data: "по данным компании",
  zone_of_influence: "направление X, 4 менеджера",
  confirmed_by: "кандидат",
  confirmed_on: "2026-10-09",
  status: "draft",
};

const minimalClaims = {
  claims: [
    {
      id: "claim1",
      statement: "рост выручки на 4,2 млн",
      quote: "цитата из файла",
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

const minimalAudit = {
  facts_hash: "sha256:abc",
  meta_hash: "sha256:def",
  generated_at: "2026-10-09T12:00:00Z",
  contradictions: [],
  open_questions: [],
  warnings: [],
  roles: [],
  ats: {},
};

const minimalValidation = {
  layer1: { ok: true },
  layer2: { checks: [], unsupported_skills: [], forbidden_words_found: [] },
};

const fullValidation = {
  layer1: {
    ok: false,
    numberErrors: [],
    skillErrors: ["SQL"],
    forbiddenFound: [],
    hedgeErrors: [],
    missingFields: [],
    shareSumOk: true,
    exceptions: ["+7 (926) 065-97-20"],
  },
  layer2: {
    checks: [
      {
        number: "4,2 млн",
        claim: "рост выручки",
        matches_fact: true,
        fact_id: "res1",
        matches_role: true,
        has_hedge: false,
        verdict: "ok",
        comment: "",
      },
    ],
    unsupported_skills: ["Go"],
    forbidden_words_found: [],
  },
};

const minimalStageState = {
  run_id: "run_2026-10-09_001",
  stages: { 1: { status: "completed", updated_at: "" } },
  documents: { hh_v1_sales: { stale: false } },
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

const baseJob = {
  id: "job1",
  company: "Компания А",
  position: "Руководитель",
  start: "2020-01",
  end: "2021-01",
  is_current: false,
};

describe("schemas accept minimal objects", () => {
  it("factsSchema accepts minimal facts", () => {
    expect(factsSchema.safeParse(minimalFacts).success).toBe(true);
  });

  it("evidenceSchema accepts minimal evidence", () => {
    expect(evidenceSchema.safeParse(minimalEvidence).success).toBe(true);
  });

  it("claimsSchema accepts minimal claims", () => {
    expect(claimsSchema.safeParse(minimalClaims).success).toBe(true);
  });

  it("claimsSchema accepts detected_roles and requires_hedge", () => {
    const extended = {
      claims: [{ ...minimalClaims.claims[0], detected_roles: ["salesops"], requires_hedge: true }],
    };

    expect(claimsSchema.safeParse(extended).success).toBe(true);
  });

  it("auditSchema accepts minimal audit", () => {
    expect(auditSchema.safeParse(minimalAudit).success).toBe(true);
  });

  it("validationSchema accepts minimal validation", () => {
    expect(validationSchema.safeParse(minimalValidation).success).toBe(true);
  });

  it("stageStateSchema accepts minimal stage-state", () => {
    expect(stageStateSchema.safeParse(minimalStageState).success).toBe(true);
  });
});

describe("factsSchema rejects invalid", () => {
  it("rejects year in start instead of YYYY-MM", () => {
    const parsed = factsSchema.safeParse(factsWithJob({ ...baseJob, start: "2020" }));

    expect(parsed.success).toBe(false);
  });

  it("rejects status outside enum", () => {
    const job = {
      ...baseJob,
      results: [
        {
          id: "res1",
          key: "revenue",
          text: "рост выручки",
          number: 4200000,
          unit: "руб.",
          currency: "RUB",
          status: "unknown",
          roles: ["sales"],
          evidence_id: "res1",
          hedge_required: false,
        },
      ],
    };

    expect(factsSchema.safeParse(factsWithJob(job)).success).toBe(false);
  });

  it("rejects share greater than 1", () => {
    const bad = {
      ...minimalFacts,
      meta: {
        ...minimalFacts.meta,
        targets: [{ id: "sales", title: "", share_of_applications: 1.5 }],
      },
    };

    expect(factsSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects schema_version != 1", () => {
    expect(factsSchema.safeParse({ ...minimalFacts, schema_version: 2 }).success).toBe(false);
  });
});

describe("factsSchema tolerates legacy facts", () => {
  it("accepts result without currency (старые facts.json)", () => {
    const result = {
      id: "res1",
      key: "",
      text: "рост выручки",
      number: 4200000,
      unit: "руб.",
      status: "confirmed",
      roles: ["sales"],
      evidence_id: "res1",
      hedge_required: false,
    };
    const legacy = factsWithJob({ ...baseJob, results: [result] });

    expect(factsSchema.safeParse(legacy).success).toBe(true);
  });
});

describe("evidenceSchema rejects invalid status", () => {
  it("rejects status outside enum", () => {
    expect(evidenceSchema.safeParse({ ...minimalEvidence, status: "unknown" }).success).toBe(false);
  });
});

describe("validationSchema strict mode", () => {
  it("accepts full object", () => {
    expect(validationSchema.safeParse(fullValidation).success).toBe(true);
  });

  it("rejects extra top-level fields", () => {
    const withExtra = { ...fullValidation, extra: 1 };

    expect(validationSchema.safeParse(withExtra).success).toBe(false);
  });
});

describe("stageStateSchema documents", () => {
  it("accepts document with stale: false", () => {
    const parsed = stageStateSchema.safeParse(minimalStageState);

    expect(parsed.success).toBe(true);
  });
});
