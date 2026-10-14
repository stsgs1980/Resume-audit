import { describe, expect, it } from "vitest";
import salesPreset from "../../config/roles/sales.json";
import type { SkillsRules } from "./skills";
import { checkSkillForRole, findSkillInText, getSkillRulesForRole, normalizeText } from "./skills";

const salesRules: SkillsRules = salesPreset.skillsRules;

describe("Test 15: навык только в поле навыков", () => {
  it('P&L в skillsField, нет в experienceText -> "in_skills_only"', () => {
    const result = checkSkillForRole(
      "P&L",
      "sales",
      "руководил отделом из десяти человек, выполнял план",
      ["P&L", "SQL"],
      salesRules,
    );

    expect(result.status).toBe("in_skills_only");
    expect(result.inExperience).toBe(false);
    expect(result.inSkillsField).toBe(true);
  });
});

describe("Test 18: навык только в поле навыков для salesops", () => {
  it('SQL в skillsField, нет в experienceText, roleId "salesops" -> "in_skills_only"', () => {
    const result = checkSkillForRole(
      "SQL",
      "salesops",
      "руководил отделом, выполнял план продаж",
      ["SQL", "переговоры"],
      salesRules,
    );

    expect(result.status).toBe("in_skills_only");
    expect(result.inExperience).toBe(false);
    expect(result.inSkillsField).toBe(true);
  });
});

describe("checkSkillForRole: остальные статусы", () => {
  it("навык в тексте опыта -> confirmed", () => {
    const result = checkSkillForRole("SQL", "sales", "знаю SQL и BI", ["SQL"], salesRules);

    expect(result.status).toBe("confirmed");
    expect(result.inExperience).toBe(true);
  });

  it("навыка нигде нет -> not_found", () => {
    const result = checkSkillForRole("Tableau", "sales", "руководил отделом", ["SQL"], salesRules);

    expect(result.status).toBe("not_found");
    expect(result.inExperience).toBe(false);
    expect(result.inSkillsField).toBe(false);
  });
});

describe("getSkillRulesForRole", () => {
  const rules: SkillsRules = { always: ["A"], sales: ["B"], salesops: ["C"] };

  it('sales -> ["A", "B"]', () => {
    expect(getSkillRulesForRole("sales", rules)).toEqual(["A", "B"]);
  });

  it('salesops -> ["A", "C"]', () => {
    expect(getSkillRulesForRole("salesops", rules)).toEqual(["A", "C"]);
  });

  it('unknown -> ["A"]', () => {
    expect(getSkillRulesForRole("unknown", rules)).toEqual(["A"]);
  });

  it("расширяемость: ядро не знает про роли", () => {
    const medical: SkillsRules = { always: [], cardiology: ["ЭКГ", "ЭхоКГ"] };

    expect(getSkillRulesForRole("cardiology", medical)).toEqual(["ЭКГ", "ЭхоКГ"]);
  });
});

describe("normalizeText", () => {
  it('"P&L" и "p&l" дают одинаковый результат', () => {
    expect(normalizeText("P&L")).toBe(normalizeText("p&l"));
  });

  it("схлопывает пробелы и приводит ё к е", () => {
    expect(normalizeText("  Вёл   отдел  ")).toBe("вел отдел");
  });
});

describe("findSkillInText", () => {
  it('"SQL" находится в "опыт SQL и BI"', () => {
    expect(findSkillInText("SQL", "опыт SQL и BI")).toBe(true);
  });

  it('"SQL" НЕ находится в "SQL-сервер" (часть слова)', () => {
    expect(findSkillInText("SQL", "администрировал SQL-сервер")).toBe(false);
  });
});
