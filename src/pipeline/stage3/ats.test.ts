import { describe, expect, it } from "vitest";
import type { Claim } from "../stage2/types";
import { analyzeAts, loadRoleConfig } from "./ats";

const claim = (overrides: Partial<Claim> = {}): Claim => ({
  id: "claim1",
  statement: "управление командой",
  quote: "управлял командой из 5 человек",
  source_file: "a.docx",
  category: "skill",
  metric_type: "",
  number: null,
  currency: null,
  status: "confirmed",
  reason: "",
  ...overrides,
});

describe("loadRoleConfig()", () => {
  it("читает sales.json с atsKeywords", async () => {
    const config = await loadRoleConfig("config/roles/sales.json");

    expect(config.id).toBe("sales");
    expect(config.atsKeywords?.mandatory).toContain("управление командой");
  });
});

describe("analyzeAts()", () => {
  it("ключ только в skills -> in_skills_only", async () => {
    const config = await loadRoleConfig("config/roles/sales.json");
    const analysis = analyzeAts([claim({ statement: "управление командой" })], config, "sales", null);
    const found = analysis.keywords.find((entry) => entry.keyword === "управление командой");

    expect(found?.category).toBe("in_skills_only");
    expect(analysis.hasVacancy).toBe(false);
  });

  it("ключ нигде -> absent", async () => {
    const config = await loadRoleConfig("config/roles/sales.json");
    const analysis = analyzeAts([claim({ statement: "нечто иное" })], config, "sales", null);
    const found = analysis.keywords.find((entry) => entry.keyword === "воронка продаж");

    expect(found?.category).toBe("absent");
    expect(analysis.mandatoryMissing).toContain("воронка продаж");
  });

  it("с вакансией: mandatoryMissing заполняется, hasVacancy true", async () => {
    const config = await loadRoleConfig("config/roles/sales.json");
    const analysis = analyzeAts(
      [claim({ statement: "нечто иное" })],
      config,
      "sales",
      "Нам нужен руководитель. Руководитель ведёт команду. Опыт продаж обязателен.",
    );

    expect(analysis.hasVacancy).toBe(true);
    expect(analysis.mandatoryMissing.length).toBeGreaterThan(0);
  });
});
