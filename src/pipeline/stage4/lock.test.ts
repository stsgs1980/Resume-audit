import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readLockState } from "../../server/storage/lock";
import { getLockPath } from "../../server/storage/paths";
import { tryLock } from "./lock";

let dir = "";

const facts = (status: string) => ({
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
      results: [
        {
          id: "res1",
          key: "",
          text: "выручка выросла",
          number: 4200000,
          unit: "",
          currency: "RUB",
          status,
          roles: ["sales"],
          evidence_id: "res1",
          hedge_required: false,
        },
      ],
    },
  ],
  education: [],
  languages: [],
  confirmed_skills: [],
  portfolio_projects: [],
});

const evidence = (status: string) => ({
  fact_id: "res1",
  source_file: "resume.docx",
  quote: "выручка выросла",
  metric_definition: "выручка",
  period: "2023",
  baseline: "база",
  source_of_data: "учёт",
  zone_of_influence: "отдел",
  confirmed_by: "candidate",
  confirmed_on: "2026-10-09",
  status,
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage4-lock-"));
  await writeFile(join(dir, "facts.json"), JSON.stringify(facts("confirmed")), "utf8");
  await writeFile(join(dir, "res1.json"), JSON.stringify(evidence("confirmed")), "utf8");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("tryLock()", () => {
  it("всё отвечено и подтверждено -> locked: true", async () => {
    const result = await tryLock(join(dir, "facts.json"), join(dir, "facts.lock"), dir, dir);

    expect(result.locked).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("остались открытые -> locked: false с reasons", async () => {
    await writeFile(join(dir, "facts.json"), JSON.stringify(facts("needs_evidence")), "utf8");

    const result = await tryLock(join(dir, "facts.json"), join(dir, "facts.lock"), dir, dir);

    expect(result.locked).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("файл от tryLock читается через readLockState", async () => {
    const config = { rootDir: dir };
    const lockPath = getLockPath(config, "ws");
    const result = await tryLock(join(dir, "facts.json"), lockPath, dir, dir);

    expect(result.locked).toBe(true);

    const state = await readLockState(config, "ws");

    expect(state.state).toBe("locked");
    expect(typeof state.lockedAt).toBe("string");
  });
});
