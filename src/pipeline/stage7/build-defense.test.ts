import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Facts } from "../../schemas/facts";
import { buildDefenseDocument } from "./build-defense";

let dir = "";

const facts = {
  jobs: [
    {
      results: [
        {
          id: "res1",
          key: "",
          text: "Выручка 4,2 млн RUB",
          number: 4200000,
          unit: "",
          currency: "RUB",
          status: "confirmed",
          roles: ["sales"],
          evidence_id: "res1",
          hedge_required: false,
        },
      ],
    },
  ],
} as unknown as Facts;

const card = {
  fact_id: "res1",
  source_file: "resume.docx",
  quote: "рост выручки",
  metric_definition: "выручка по направлению X",
  formula: "выручка_2023 - выручка_2022",
  period: "2023-01 - 2023-12",
  baseline: "выручка_2022 = 18,4 млн",
  source_of_data: "по данным компании",
  zone_of_influence: "направление X, 4 менеджера",
  confirmed_by: "кандидат",
  confirmed_on: "2026-10-09",
  status: "confirmed",
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage7-defense-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("buildDefenseDocument()", () => {
  it("с evidence -> полный блок", async () => {
    await writeFile(join(dir, "res1.json"), JSON.stringify(card), "utf8");

    const markdown = await buildDefenseDocument(facts, dir);

    expect(markdown).toContain("## res1");
    expect(markdown).toContain("Определение метрики: выручка по направлению X");
    expect(markdown).toContain("Формула: выручка_2023 - выручка_2022");
    expect(markdown).toContain('Цитата: "рост выручки"');
  });

  it("без evidence -> Доказательства не заполнены", async () => {
    const markdown = await buildDefenseDocument(facts, dir);

    expect(markdown).toContain("## res1");
    expect(markdown).toContain("Доказательства не заполнены");
  });

  it("markdown с заголовками", async () => {
    const markdown = await buildDefenseDocument(facts, dir);
    const headings = markdown.split("\n").filter((line) => line.startsWith("## "));

    expect(headings.length).toBeGreaterThan(0);
  });
});
