import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OpenQuestion } from "../stage3/types";
import { writeEvidence } from "./evidence-writer";
import type { EvidenceData, JobResult } from "./types";

let dir = "";

const question: OpenQuestion = {
  id: "q_001",
  type: "missing_evidence",
  question: "Чем подтверждается?",
  context: "a.docx",
  relatedClaimIds: ["claim13"],
  createdFrom: "audit#gap",
};

const data: EvidenceData = {
  sourceFile: "resume.docx",
  quote: "выручка выросла",
  metricDefinition: "выручка направления",
  formula: "a - b",
  period: "2023",
  baseline: "база",
  sourceOfData: "учёт",
  zoneOfInfluence: "отдел",
};

const result: JobResult = {
  id: "res1",
  key: "",
  text: "выручка выросла",
  number: 4200000,
  unit: "",
  currency: "RUB",
  status: "needs_evidence",
  roles: ["sales"],
  evidence_id: "res1",
  hedge_required: false,
  source_claim_id: "claim13",
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage4-evidence-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("writeEvidence()", () => {
  it("claim id разрешается в evidence_id результата", async () => {
    const { factId, warnings } = await writeEvidence(question, data, [result], dir);

    expect(factId).toBe("res1");
    expect(warnings).toEqual([]);

    const stored = JSON.parse(await readFile(join(dir, "res1.json"), "utf8")) as Record<string, unknown>;

    expect(stored).toMatchObject({
      fact_id: "res1",
      source_file: "resume.docx",
      quote: "выручка выросла",
      metric_definition: "выручка направления",
      formula: "a - b",
      period: "2023",
      baseline: "база",
      source_of_data: "учёт",
      zone_of_influence: "отдел",
      confirmed_by: "candidate",
      status: "confirmed",
    });
  });

  it("confirmed_on = сегодняшняя дата", async () => {
    await writeEvidence(question, data, [result], dir);

    const stored = JSON.parse(await readFile(join(dir, "res1.json"), "utf8")) as {
      confirmed_on: string;
    };

    expect(stored.confirmed_on).toBe(new Date().toISOString().slice(0, 10));
  });

  it("без связи пишет по claim id с warning", async () => {
    const { factId, warnings } = await writeEvidence(question, data, [], dir);

    expect(factId).toBe("claim13");
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("без relatedClaimIds использует questionId как fallback", async () => {
    const { factId } = await writeEvidence({ ...question, relatedClaimIds: [] }, data, [], dir);

    expect(factId).toBe("q_001");
  });
});
