import { describe, expect, it } from "vitest";
import type { Claim } from "../stage2/types";
import { detectParallelRoles, detectSkillConflicts } from "./overlap-check";

const employment = (overrides: Partial<Claim> = {}): Claim => ({
  id: "claim1",
  statement: "работал",
  quote: "работал",
  source_file: "a.docx",
  category: "employment",
  metric_type: "",
  number: null,
  currency: null,
  status: "confirmed",
  reason: "",
  ...overrides,
});

const skill = (overrides: Partial<Claim> = {}): Claim => ({
  ...employment(),
  category: "skill",
  ...overrides,
});

describe("detectParallelRoles()", () => {
  it("пересекающиеся роли -> parallel_roles", () => {
    const result = detectParallelRoles([
      employment({ quote: "работал 2020-01 - 2020-12" }),
      employment({ id: "claim2", quote: "работал 2020-06 - 2021-06" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("parallel_roles");
  });

  it("смежность (end == start) -> нет вопроса", () => {
    const result = detectParallelRoles([
      employment({ quote: "работал 2020-01 - 2020-06" }),
      employment({ id: "claim2", quote: "работал 2020-06 - 2020-12" }),
    ]);

    expect(result).toEqual([]);
  });
});

describe("detectSkillConflicts()", () => {
  it("confirmed против needs_evidence -> warning", () => {
    const result = detectSkillConflicts([
      skill({ statement: "SQL", status: "confirmed" }),
      skill({ id: "claim2", statement: "SQL", status: "needs_evidence" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.severity).toBe("warning");
  });

  it("одинаковые статусы -> нет противоречий", () => {
    const result = detectSkillConflicts([
      skill({ statement: "SQL", status: "confirmed" }),
      skill({ id: "claim2", statement: "Excel", status: "confirmed" }),
    ]);

    expect(result).toEqual([]);
  });
});
