import { describe, expect, it } from "vitest";
import { detectClaimCompany, extractCompany } from "./company";

describe("extractCompany()", () => {
  it("в ООО Ромашка -> Ромашка (форма пропускается)", () => {
    expect(extractCompany("работал в ООО Ромашка")).toBe("Ромашка");
  });

  it("в компании Ромашка -> Ромашка", () => {
    expect(extractCompany("работал в компании Ромашка")).toBe("Ромашка");
  });

  it("в Ромашке -> Ромашке", () => {
    expect(extractCompany("работал в Ромашке")).toBe("Ромашке");
  });

  it("в ромашке -> null (нет заглавной)", () => {
    expect(extractCompany("работал в ромашке")).toBeNull();
  });

  it("в ООО -> null (только форма)", () => {
    expect(extractCompany("работал в ООО")).toBeNull();
  });

  it("в ИП Иванов -> Иванов", () => {
    expect(extractCompany("работал в ИП Иванов")).toBe("Иванов");
  });

  it("кавычки не захватываются: ООО «Ромашка Плюс» -> Ромашка Плюс", () => {
    expect(extractCompany("работал в ООО «Ромашка Плюс»")).toBe("Ромашка Плюс");
  });

  it("останавливается на предлоге: Ромашка с 2020-01 -> Ромашка", () => {
    expect(extractCompany("работал в компании Ромашка с 2020-01")).toBe("Ромашка");
  });

  it("нет контекста -> null", () => {
    expect(extractCompany("руководитель отдела продаж")).toBeNull();
  });
});

describe("detectClaimCompany()", () => {
  it("цитата как fallback, если в формулировке компании нет", () => {
    const company = detectClaimCompany({
      statement: "работал руководителем",
      quote: "работал в компании Ромашка",
    });

    expect(company).toBe("Ромашка");
  });

  it("компания из формулировки приоритетнее цитаты", () => {
    const company = detectClaimCompany({
      statement: "работал в компании Лютик",
      quote: "работал в компании Ромашка",
    });

    expect(company).toBe("Лютик");
  });
});
