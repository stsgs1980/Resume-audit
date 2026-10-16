import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OpenQuestion } from "../stage3/types";
import { writeEvidence } from "./evidence-writer";
import type { EvidenceData } from "./types";

let dir = "";

const question: OpenQuestion = {
  id: "q_001",
  type: "missing_evidence",
  question: "Чем подтверждается?",
  context: "a.docx",
  relatedClaimIds: ["res1"],
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

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage4-evidence-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("writeEvidence()", () => {
  it("пишет карточку в evidence/<fact_id>.json", async () => {
    const factId = await writeEvidence(question, data, [], dir);

    expect(factId).toBe("res1");

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
    await writeEvidence(question, data, [], dir);

    const stored = JSON.parse(await readFile(join(dir, "res1.json"), "utf8")) as {
      confirmed_on: string;
    };

    expect(stored.confirmed_on).toBe(new Date().toISOString().slice(0, 10));
  });

  it("без relatedClaimIds использует questionId как fallback", async () => {
    const factId = await writeEvidence({ ...question, relatedClaimIds: [] }, data, [], dir);

    expect(factId).toBe("q_001");
  });
});
