import { describe, expect, it } from "vitest";
import { computeBlockReason, isBlocked } from "./block";
import type { ValidationLayer1, ValidationLayer2 } from "./types";

/**
 * Чистый слой 1 без ошибок.
 *
 * @returns слой 1
 */
const cleanLayer1 = (): ValidationLayer1 => {
  return {
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
};

describe("computeBlockReason()", () => {
  it("нет ошибок -> reasons []", () => {
    expect(computeBlockReason(cleanLayer1(), null)).toEqual([]);
  });

  it("numberErrors -> blocked", () => {
    const layer1 = cleanLayer1();

    layer1.numberErrors = [{ number: "7,5 млрд", factId: null, reason: "unsupported_number" }];

    expect(isBlocked(computeBlockReason(layer1, null))).toBe(true);
  });

  it("layer2 verdict not ok -> blocked", () => {
    const layer2: ValidationLayer2 = {
      checks: [
        {
          number: "4,2 млн",
          claim: "",
          matchesFact: false,
          factId: null,
          matchesRole: true,
          hasHedge: false,
          verdict: "unsupported_number",
          comment: "",
        },
      ],
      unsupportedSkills: [],
      forbiddenWordsFound: [],
    };

    const reasons = computeBlockReason(cleanLayer1(), layer2);

    expect(reasons.length).toBeGreaterThan(0);
    expect(isBlocked(reasons)).toBe(true);
  });
});
