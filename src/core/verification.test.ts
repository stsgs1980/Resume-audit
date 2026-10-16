import { describe, expect, it } from "vitest";
import { extractNumbers, verifyNumbers } from "./number-check";
import { verify, verifyHedge, verifyRequiredFields, verifyShareSum, verifySkills } from "./verification";

describe("Test 20: число без факта блокирует", () => {
  it('"7,5 млрд" нет в factsNumbers -> found: false', () => {
    const results = verifyNumbers(
      "выручка 7,5 млрд за год",
      [{ factId: "f1", value: 4_200_000, currency: null, qualifier: "exact", roles: ["sales"] }],
      "sales",
    );
    const target = results.find((result) => result.number === "7,5 млрд");

    expect(target?.found).toBe(false);
    expect(target?.factId).toBeNull();
  });
});

describe("verifyNumbers: currency", () => {
  it("4,2 млн USD против факта RUB -> found: false", () => {
    const results = verifyNumbers(
      "сделка 4,2 млн USD",
      [{ factId: "f1", value: 4_200_000, currency: "RUB", qualifier: "exact", roles: ["sales"] }],
      "sales",
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.found).toBe(false);
    expect(results[0]?.reason).toContain("currency_mismatch");
  });

  it("4,2 млн RUB против факта RUB -> found: true", () => {
    const results = verifyNumbers(
      "сделка 4,2 млн RUB",
      [{ factId: "f1", value: 4_200_000, currency: "RUB", qualifier: "exact", roles: ["sales"] }],
      "sales",
    );

    expect(results[0]?.found).toBe(true);
    expect(results[0]?.factId).toBe("f1");
  });

  it("у факта currency null -> found с warning", () => {
    const results = verifyNumbers(
      "сделка 4,2 млн RUB",
      [{ factId: "f1", value: 4_200_000, currency: null, qualifier: "exact", roles: ["sales"] }],
      "sales",
    );

    expect(results[0]?.found).toBe(true);
    expect(results[0]?.reason).toContain("валюта");
  });
});

describe("verifyNumbers: qualifier", () => {
  it("45 % против факта exact 45 -> found: false", () => {
    const results = verifyNumbers(
      "доля 45 %",
      [{ factId: "f1", value: 45, currency: null, qualifier: "exact", roles: ["sales"] }],
      "sales",
    );

    expect(results[0]?.found).toBe(false);
    expect(results[0]?.reason).toContain("qualifier_mismatch");
  });

  it("45 человек против факта exact 45 -> found: true", () => {
    const results = verifyNumbers(
      "команда 45 человек",
      [{ factId: "f1", value: 45, currency: null, qualifier: "exact", roles: ["sales"] }],
      "sales",
    );

    expect(results[0]?.found).toBe(true);
    expect(results[0]?.factId).toBe("f1");
  });

  it("approx факта против exact токена -> found с округлением", () => {
    const results = verifyNumbers(
      "команда 45 человек",
      [{ factId: "f1", value: 45, currency: null, qualifier: "approx", roles: ["sales"] }],
      "sales",
    );

    expect(results[0]?.found).toBe(true);
    expect(results[0]?.reason).toContain("округление");
  });
});

describe("verifyNumbers: filter по ролям", () => {
  it("два факта value 45, первый чужой роли -> found второго", () => {
    const results = verifyNumbers(
      "результат 45",
      [
        { factId: "resA", value: 45, currency: null, qualifier: "exact", roles: ["salesops"] },
        { factId: "resB", value: 45, currency: null, qualifier: "exact", roles: ["sales"] },
      ],
      "sales",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ number: "45", found: true, factId: "resB" });
  });

  it("совпадение по value, но ни один не для роли -> wrong_role", () => {
    const results = verifyNumbers(
      "результат 45",
      [{ factId: "resA", value: 45, currency: null, qualifier: "exact", roles: ["salesops"] }],
      "sales",
    );

    expect(results[0]?.found).toBe(false);
    expect(results[0]?.factId).toBe("resA");
    expect(results[0]?.reason).toContain("wrong_role");
  });
});

describe("Test 23: сумма долей вне допуска", () => {
  it("[0.5, 0.55] (сумма 1.05) -> false", () => {
    expect(verifyShareSum([0.5, 0.55])).toBe(false);
  });

  it("[0.7, 0.25, 0.05] (сумма 1.0) -> true", () => {
    expect(verifyShareSum([0.7, 0.25, 0.05])).toBe(true);
  });
});

describe("Test 24: телефон — исключение", () => {
  it('"+7 (926) 065-97-20" не попадает в numberErrors', () => {
    const results = verifyNumbers("тел. +7 (926) 065-97-20", [], "sales");

    expect(results).toEqual([]);
    expect(extractNumbers("тел. +7 (926) 065-97-20")).toEqual([]);
  });
});

describe("extractNumbers: исключения", () => {
  it("год 2024 — не число, 4,2 млн — число", () => {
    expect(extractNumbers("В 2024 году выручка 4,2 млн")).toEqual(["4,2 млн"]);
  });

  it("номер списка 1. — не число", () => {
    expect(extractNumbers("1. Первый пункт")).toEqual([]);
  });

  it("версия v2 — не число", () => {
    expect(extractNumbers("перешли на v2 платформы")).toEqual([]);
  });
});

describe("verifySkills", () => {
  it("навык с чужой ролью -> в списке ошибок", () => {
    expect(verifySkills(["SQL"], [{ skill: "SQL", roles: ["salesops"] }], "sales")).toEqual(["SQL"]);
  });

  it("навык с нужной ролью -> ошибок нет", () => {
    expect(verifySkills(["SQL"], [{ skill: "SQL", roles: ["sales"] }], "sales")).toEqual([]);
  });
});

describe("verifyHedge", () => {
  it("factId в hedgeRequired, нет в factIdsWithHedge -> ошибка", () => {
    expect(verifyHedge([], ["f1"])).toEqual(["f1"]);
  });

  it("оговорка есть -> ошибок нет", () => {
    expect(verifyHedge(["f1"], ["f1"])).toEqual([]);
  });
});

describe("verifyRequiredFields", () => {
  it('пустое поле "title" -> в missingFields', () => {
    expect(verifyRequiredFields({ title: "", name: "Иван" })).toEqual(["title"]);
  });
});

describe("verify: happy path", () => {
  it("все данные корректны -> ok: true", () => {
    const result = verify({
      resumeText: "Руководил отделом. Знаю SQL.",
      factsNumbers: [],
      resumeSkills: ["SQL"],
      confirmedSkills: [{ skill: "SQL", roles: ["sales"] }],
      roleId: "sales",
      forbiddenWords: ["production"],
      hedgeRequiredFactIds: [],
      factIdsWithHedge: [],
      requiredFields: { title: "Руководитель", name: "Иван" },
      targetShares: [0.7, 0.25, 0.05],
    });

    expect(result.ok).toBe(true);
    expect(result.numberErrors).toEqual([]);
    expect(result.shareSumOk).toBe(true);
  });

  it("число без факта -> ok: false", () => {
    const result = verify({
      resumeText: "выручка 7,5 млрд",
      factsNumbers: [],
      resumeSkills: [],
      confirmedSkills: [],
      roleId: "sales",
      forbiddenWords: [],
      hedgeRequiredFactIds: [],
      factIdsWithHedge: [],
      requiredFields: { title: "Руководитель" },
      targetShares: [1],
    });

    expect(result.ok).toBe(false);
    expect(result.numberErrors).toHaveLength(1);
  });
});
