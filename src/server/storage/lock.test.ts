import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Evidence } from "../../schemas/evidence";
import type { Facts } from "../../schemas/facts";
import { writeJsonAtomic } from "./files";
import { canLock, readLockState, writeLockState } from "./lock";
import type { StorageConfig } from "./paths";
import { getLockPath } from "./paths";

let dir = "";
let config: StorageConfig = { rootDir: "" };

const baseResult: {
  id: string;
  key: string;
  text: string;
  number: number;
  unit: string;
  currency: "RUB";
  status: "confirmed" | "needs_evidence";
  roles: string[];
  evidence_id: string;
  hedge_required: boolean;
} = {
  id: "res1",
  key: "k",
  text: "t",
  number: 1,
  unit: "u",
  currency: "RUB",
  status: "confirmed",
  roles: ["sales"],
  evidence_id: "res1",
  hedge_required: false,
};

const baseJob: {
  id: string;
  company: string;
  position: string;
  start: string;
  is_current: boolean;
} = {
  id: "job1",
  company: "A",
  position: "P",
  start: "2020-01",
  is_current: false,
};

const makeFacts = (shares: number[], status: "confirmed" | "needs_evidence" = "confirmed"): Facts => ({
  schema_version: 1,
  meta: {
    candidate_name: "",
    audit_date: "2026-10-09",
    geography: "",
    targets: shares.map((share, index) => ({
      id: `role${index}`,
      title: "",
      share_of_applications: share,
    })),
  },
  jobs: [
    {
      ...baseJob,
      results: [{ ...baseResult, status, currency: "RUB" as const }],
    },
  ],
  education: [],
  languages: [],
  confirmed_skills: [],
  portfolio_projects: [],
});

const makeEvidence = (status: Evidence["status"]): Evidence[] => [
  {
    fact_id: "res1",
    source_file: "f.docx",
    quote: "q",
    metric_definition: "m",
    period: "p",
    baseline: "b",
    source_of_data: "s",
    zone_of_influence: "z",
    confirmed_by: "c",
    confirmed_on: "2026-10-09",
    status,
  },
];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "storage-lock-"));
  config = { rootDir: dir };
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("readLockState / writeLockState", () => {
  it('по умолчанию "draft"', async () => {
    expect(await readLockState(config, "ws1")).toBe("draft");
  });

  it('запись "locked", чтение "locked"', async () => {
    await writeLockState(config, "ws1", "locked");

    expect(await readLockState(config, "ws1")).toBe("locked");
  });

  it("неизвестное значение в файле -> throw", async () => {
    await writeJsonAtomic(getLockPath(config, "ws1"), "bogus");

    await expect(readLockState(config, "ws1")).rejects.toThrow();
  });
});

describe("canLock", () => {
  it("открытый needs_evidence -> ok: false с причиной", () => {
    const result = canLock(makeFacts([0.7, 0.25, 0.05], "needs_evidence"), makeEvidence("confirmed"));

    expect(result.ok).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("сумма долей 1.05 -> ok: false", () => {
    const result = canLock(makeFacts([0.5, 0.55]), []);

    expect(result.ok).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("корректные данные -> ok: true", () => {
    expect(canLock(makeFacts([0.7, 0.25, 0.05]), makeEvidence("confirmed"))).toEqual({
      ok: true,
      reasons: [],
    });
  });

  it("evidence не confirmed -> ok: false", () => {
    expect(canLock(makeFacts([1]), makeEvidence("pending")).ok).toBe(false);
  });
});
