import { describe, expect, it } from "vitest";
import type { Claim } from "../stage2/types";
import { buildEducation, buildLanguages, buildProjects, buildSkills } from "./build-entities";

const claim = (overrides: Partial<Claim> = {}): Claim => ({
  id: "claim1",
  statement: "МГУ, экономика",
  quote: "окончил МГУ",
  source_file: "a.docx",
  category: "education",
  metric_type: "",
  number: null,
  currency: null,
  status: "confirmed",
  reason: "",
  ...overrides,
});

const roles = ["sales", "salesops"];

describe("buildEducation()", () => {
  it("записи edu1, edu2", () => {
    const education = buildEducation([claim(), claim({ id: "claim2", statement: "ВШЭ" })]);

    expect(education.map((entry) => entry.id)).toEqual(["edu1", "edu2"]);
    expect(education[0]?.institution).toContain("МГУ");
  });
});

describe("buildLanguages()", () => {
  it("записи lang1, lang2", () => {
    const languages = buildLanguages([
      claim({ id: "claim1", category: "language", statement: "Английский" }),
      claim({ id: "claim2", category: "language", statement: "Немецкий" }),
    ]);

    expect(languages.map((entry) => entry.id)).toEqual(["lang1", "lang2"]);
  });
});

describe("buildSkills()", () => {
  it("только confirmed попадают", () => {
    const skills = buildSkills([
      claim({ category: "skill", statement: "SQL", status: "confirmed" }),
      claim({ id: "claim2", category: "skill", statement: "Go", status: "needs_evidence" }),
    ]);

    expect(skills.map((entry) => entry.id)).toEqual(["sk1"]);
    expect(skills[0]?.skill).toBe("SQL");
  });

  it("roles у skills = все целевые", () => {
    const skills = buildSkills([claim({ category: "skill", statement: "SQL" })], roles);

    expect(skills[0]?.roles).toEqual(roles);
  });
});

describe("buildProjects()", () => {
  it("запись proj1", () => {
    const projects = buildProjects([claim({ category: "project", statement: "CRM-пилот" })], roles);

    expect(projects.map((entry) => entry.id)).toEqual(["proj1"]);
    expect(projects[0]?.roles).toEqual(roles);
  });
});
