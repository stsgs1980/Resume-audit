import { describe, expect, it } from "vitest";
import type { ResumeResponse } from "../../llm/schemas";
import type { Facts } from "../../schemas/facts";
import { verifyNumbers } from "./layer1-numbers";

/**
 * Минимальное резюме для проверки чисел.
 *
 * @param about - поле about
 * @param resultText - текст результата
 * @returns резюме
 */
const makeResume = (about: string, resultText: string): ResumeResponse => {
  return {
    title: "Руководитель",
    specialization: "sales",
    employment_type: "full",
    work_format: "office",
    experience_total: "10 лет",
    experience_as_of: "2026-10-09",
    about,
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
        results: [{ text: resultText, fact_id: "res1", hedge_present: true }],
        total_experience_inconsistent: false,
        total_experience_note: "",
      },
    ],
    skills: [],
    languages: [],
  };
};

/**
 * Минимальные факты с заданными результатами.
 *
 * @param results - результаты фактов
 * @returns факты
 */
const makeFacts = (
  results: Array<{
    id: string;
    number: number | null;
    roles: string[];
    currency?: "RUB" | "USD" | "EUR" | null;
    unit?: string;
  }>,
): Facts => {
  return {
    schema_version: 1,
    meta: {
      candidate_name: "",
      audit_date: "2026-10-09",
      geography: "",
      targets: [{ id: "sales", title: "", share_of_applications: 1 }],
    },
    jobs: [
      {
        id: "job1",
        company: "Ромашка",
        position: "Руководитель",
        start: "2020-01",
        end: "2021-01",
        is_current: false,
        results: results.map((entry) => ({
          id: entry.id,
          key: "",
          text: "",
          number: entry.number,
          unit: entry.unit ?? "",
          ...(entry.currency === undefined ? {} : { currency: entry.currency }),
          status: "confirmed",
          roles: entry.roles,
          evidence_id: entry.id,
          hedge_required: false,
        })),
      },
    ],
    education: [],
    languages: [],
    confirmed_skills: [],
    portfolio_projects: [],
  } as unknown as Facts;
};

describe("verifyNumbers()", () => {
  it("число из resume есть в facts -> ok", () => {
    const resume = makeResume("", "Выручка выросла на 4,2 млн RUB");
    const facts = makeFacts([{ id: "res1", number: 4200000, roles: ["sales"] }]);

    expect(verifyNumbers(resume, facts, "sales").errors).toEqual([]);
  });

  it("число 7,5 млрд нет в facts -> unsupported_number", () => {
    const resume = makeResume("", "Сделка на 7,5 млрд RUB");
    const facts = makeFacts([{ id: "res1", number: 4200000, roles: ["sales"] }]);
    const { errors } = verifyNumbers(resume, facts, "sales");

    expect(errors).toHaveLength(1);
    expect(errors[0]?.reason).toContain("unsupported_number");
  });

  it("число из факта чужой роли -> wrong_role", () => {
    const resume = makeResume("", "Выручка выросла на 4,2 млн RUB");
    const facts = makeFacts([{ id: "res1", number: 4200000, roles: ["salesops"] }]);
    const { errors } = verifyNumbers(resume, facts, "sales");

    expect(errors).toHaveLength(1);
    expect(errors[0]?.reason).toContain("wrong_role");
    expect(errors[0]?.factId).toBe("res1");
  });

  it("телефон +7 (...) -> в exceptions, не ошибка", () => {
    const resume = makeResume("Звоните +7 (926) 123-45-67", "Без цифр");
    const facts = makeFacts([]);
    const { errors, exceptions } = verifyNumbers(resume, facts, "sales");

    expect(errors).toEqual([]);
    expect(exceptions.some((entry) => entry.includes("+7"))).toBe(true);
  });

  it("год 2024 -> в exceptions", () => {
    const resume = makeResume("Работал в 2024 году", "Без цифр");
    const facts = makeFacts([]);
    const { errors, exceptions } = verifyNumbers(resume, facts, "sales");

    expect(errors).toEqual([]);
    expect(exceptions).toContain("2024");
  });

  it("4,2 млн USD против факта RUB -> currency_mismatch", () => {
    const resume = makeResume("", "Выручка выросла на 4,2 млн USD");
    const facts = makeFacts([{ id: "res1", number: 4200000, roles: ["sales"], currency: "RUB" }]);
    const { errors } = verifyNumbers(resume, facts, "sales");

    expect(errors).toHaveLength(1);
    expect(errors[0]?.reason).toContain("currency_mismatch");
  });

  it("45 % против факта exact 45 -> qualifier_mismatch", () => {
    const resume = makeResume("", "Доля составила 45 %");
    const facts = makeFacts([{ id: "res1", number: 45, roles: ["sales"] }]);
    const { errors } = verifyNumbers(resume, facts, "sales");

    expect(errors).toHaveLength(1);
    expect(errors[0]?.reason).toContain("qualifier_mismatch");
  });

  it("два факта value 45, первый чужой роли -> ok", () => {
    const resume = makeResume("", "Результат 45");
    const facts = makeFacts([
      { id: "resA", number: 45, roles: ["salesops"] },
      { id: "resB", number: 45, roles: ["sales"] },
    ]);

    expect(verifyNumbers(resume, facts, "sales").errors).toEqual([]);
  });

  it("старый facts.json без currency: валютное число не блокируется", () => {
    const resume = makeResume("", "Выручка выросла на 1,2 млн руб");
    const facts = makeFacts([{ id: "res1", number: 1200000, roles: ["sales"] }]);
    const { errors } = verifyNumbers(resume, facts, "sales");

    expect(errors).toEqual([]);
  });
});
