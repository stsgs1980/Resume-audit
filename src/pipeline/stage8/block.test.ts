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

  it("forbiddenFound -> blocked", () => {
    const layer1 = cleanLayer1();

    layer1.forbiddenFound = ["production"];

    expect(computeBlockReason(layer1, null)).toContain("найдены запрещённые слова");
    expect(isBlocked(computeBlockReason(layer1, null))).toBe(true);
  });

  it("placeholdersFound -> blocked", () => {
    const layer1 = cleanLayer1();

    layer1.placeholdersFound = ["\\+7\\s*\\(XXX\\)"];

    expect(computeBlockReason(layer1, null)).toContain("найдены плейсхолдеры");
    expect(isBlocked(computeBlockReason(layer1, null))).toBe(true);
  });

  it("targetMetricsInResults -> blocked", () => {
    const layer1 = cleanLayer1();

    layer1.targetMetricsInResults = ["5 млн"];

    expect(computeBlockReason(layer1, null)).toContain("целевые метрики в блоке результатов");
    expect(isBlocked(computeBlockReason(layer1, null))).toBe(true);
  });

  it("порядок причин: числа, навыки, слова, плейсхолдеры, метрики, hedge, заголовок, поля, доли", () => {
    const layer1 = cleanLayer1();

    layer1.numberErrors = [{ number: "7,5 млрд", factId: null, reason: "unsupported_number" }];
    layer1.skillErrors = ["Go"];
    layer1.forbiddenFound = ["production"];
    layer1.placeholdersFound = ["XXX"];
    layer1.targetMetricsInResults = ["5 млн"];
    layer1.hedgeErrors = ["res1"];
    layer1.titleOk = false;
    layer1.requiredFieldsMissing = ["about"];
    layer1.shareSumOk = false;

    expect(computeBlockReason(layer1, null)).toEqual([
      "числа не найдены в facts.json",
      "неподтверждённые навыки",
      "найдены запрещённые слова",
      "найдены плейсхолдеры",
      "целевые метрики в блоке результатов",
      "отсутствует оговорка",
      "заголовок не соответствует роли",
      "не все обязательные поля hh.ru",
      "сумма долей вне [0.99, 1.01]",
    ]);
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
