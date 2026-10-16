import { describe, expect, it } from "vitest";
import { validationSchema } from "./validation";

const layer1 = {
  numberErrors: [],
  skillErrors: [],
  forbiddenFound: [],
  placeholdersFound: [],
  titleOk: true,
  requiredFieldsMissing: [],
  hedgeErrors: [],
  targetMetricsInResults: [],
  shareSumOk: true,
  exceptions: [],
};

const minimalValidation = {
  versionId: "hh_v1_sales",
  roleId: "sales",
  validatedAt: "2026-10-09T12:00:00Z",
  factsHash: "sha256:abc",
  promptVersion: null,
  modelId: null,
  layer1,
  layer2: null,
  blocked: false,
  blockReasons: [],
};

const fullValidation = {
  ...minimalValidation,
  promptVersion: "verification.v1",
  modelId: "opencode/big-pickle",
  layer1: {
    ...layer1,
    skillErrors: ["SQL"],
    exceptions: ["+7 (926) 065-97-20"],
  },
  layer2: {
    checks: [
      {
        number: "4,2 млн",
        claim: "рост выручки",
        matchesFact: true,
        factId: "res1",
        matchesRole: true,
        hasHedge: false,
        verdict: "ok",
        comment: "",
      },
    ],
    unsupportedSkills: ["Go"],
    forbiddenWordsFound: [],
  },
};

describe("validationSchema", () => {
  it("accepts minimal validation", () => {
    expect(validationSchema.safeParse(minimalValidation).success).toBe(true);
  });

  it("accepts full validation", () => {
    expect(validationSchema.safeParse(fullValidation).success).toBe(true);
  });

  it("rejects verdict outside enum", () => {
    const bad = {
      ...fullValidation,
      layer2: {
        ...fullValidation.layer2,
        checks: [{ ...fullValidation.layer2.checks[0], verdict: "OK" }],
      },
    };

    expect(validationSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects extra top-level fields", () => {
    expect(validationSchema.safeParse({ ...fullValidation, extra: 1 }).success).toBe(false);
  });
});
