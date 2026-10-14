import { describe, expect, it } from "vitest";
import type { Facts } from "../../schemas/facts";
import { canonicalize, hashFacts, hashMeta } from "./hash";

const baseFacts: Facts = {
  schema_version: 1,
  meta: {
    candidate_name: "",
    audit_date: "2026-10-09",
    geography: "",
    targets: [{ id: "sales", title: "", share_of_applications: 1 }],
  },
  jobs: [],
  education: [],
  languages: [],
  confirmed_skills: [],
  portfolio_projects: [],
};

describe("canonicalize", () => {
  it("сортирует ключи, массивы сохраняют порядок", () => {
    expect(canonicalize({ b: 1, a: [3, 2] })).toBe(canonicalize({ a: [3, 2], b: 1 }));
    expect(canonicalize({ a: [1, 2] })).not.toBe(canonicalize({ a: [2, 1] }));
  });
});

describe("hashFacts", () => {
  it("не меняется от перестановки ключей", () => {
    const reordered: Facts = {
      portfolio_projects: [],
      confirmed_skills: [],
      languages: [],
      education: [],
      jobs: [],
      meta: {
        targets: [{ share_of_applications: 1, title: "", id: "sales" }],
        geography: "",
        audit_date: "2026-10-09",
        candidate_name: "",
      },
      schema_version: 1,
    };

    expect(hashFacts(reordered)).toBe(hashFacts(baseFacts));
  });

  it("меняется при изменении jobs", () => {
    const changed: Facts = {
      ...baseFacts,
      jobs: [
        {
          id: "job1",
          company: "A",
          position: "P",
          start: "2020-01",
          is_current: false,
        },
      ],
    };

    expect(hashFacts(changed)).not.toBe(hashFacts(baseFacts));
  });

  it("НЕ меняется при изменении meta.audit_date", () => {
    const changed: Facts = {
      ...baseFacts,
      meta: { ...baseFacts.meta, audit_date: "2026-11-09" },
    };

    expect(hashFacts(changed)).toBe(hashFacts(baseFacts));
  });

  it("начинается с sha256:", () => {
    expect(hashFacts(baseFacts).startsWith("sha256:")).toBe(true);
  });
});

describe("hashMeta", () => {
  it("меняется при изменении audit_date", () => {
    const changed: Facts = {
      ...baseFacts,
      meta: { ...baseFacts.meta, audit_date: "2026-11-09" },
    };

    expect(hashMeta(changed)).not.toBe(hashMeta(baseFacts));
  });

  it("НЕ меняется при изменении jobs", () => {
    const changed: Facts = { ...baseFacts, jobs: [] };

    expect(hashMeta(changed)).toBe(hashMeta(baseFacts));
  });

  it("начинается с sha256:", () => {
    expect(hashMeta(baseFacts).startsWith("sha256:")).toBe(true);
  });
});
