import { describe, expect, it } from "vitest";
import type { Facts } from "../../schemas/facts";
import { buildLlmInput } from "./build-input";
import type { RoleProfile } from "./load-profile";

const facts = {
  schema_version: 1,
  meta: {
    candidate_name: "Иван",
    audit_date: "2026-10-09",
    geography: "Москва",
    targets: [{ id: "sales", title: "Руководитель", share_of_applications: 1 }],
  },
  jobs: [
    {
      id: "job1",
      company: "Ромашка",
      position: "Руководитель",
      start: "2020-01",
      end: "2021-01",
      is_current: false,
    },
  ],
  education: [],
  languages: [],
  confirmed_skills: [],
  portfolio_projects: [],
} as unknown as Facts;

const profile: RoleProfile = {
  id: "sales",
  title: "Руководитель отдела продаж",
  skillsRules: { always: [] },
};

describe("buildLlmInput()", () => {
  it("содержит facts JSON", () => {
    expect(buildLlmInput(facts, profile, "sales")).toContain("Ромашка");
  });

  it("содержит roleProfile", () => {
    expect(buildLlmInput(facts, profile, "sales")).toContain("Руководитель отдела продаж");
  });

  it("не содержит claims", () => {
    expect(buildLlmInput(facts, profile, "sales")).not.toContain('"claims"');
  });

  it("формат FACTS + ROLE PROFILE", () => {
    const input = buildLlmInput(facts, profile, "sales");

    expect(input.startsWith("FACTS:\n")).toBe(true);
    expect(input).toContain("\n\nROLE PROFILE:\n");
  });
});
