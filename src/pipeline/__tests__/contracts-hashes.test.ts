import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Claim } from "../../schemas/claims";
import type { Facts } from "../../schemas/facts";
import { hashFacts, hashMeta } from "../../server/storage/hash";
import { runStage3a } from "../stage3/index";
import { runStage4a } from "../stage4/index";
import type { Stage4aParams } from "../stage4/types";

let dir = "";

const validFacts = {
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
} as unknown as Facts;

const resultClaim: Claim = {
  id: "claim1",
  statement: "выручка 4,2 млн руб.",
  quote: "выручка 4,2 млн руб.",
  source_file: "a.docx",
  category: "result",
  metric_type: "выручка",
  number: 4200000,
  currency: "RUB",
  status: "confirmed",
  reason: "",
};

const employmentClaim: Claim = {
  id: "claim1",
  statement: "работал в компании Ромашка руководителем",
  quote: "работал в компании Ромашка с 2020-01 по 2021-01",
  source_file: "a.docx",
  category: "employment",
  metric_type: "",
  number: null,
  currency: null,
  status: "confirmed",
  reason: "",
};

const emptyAudit = () => ({
  facts_hash: "",
  meta_hash: "",
  generated_at: "2026-10-09T12:00:00Z",
  contradictions: [],
  open_questions: [],
  warnings: [],
  roles: [],
  ats: {},
});

const stage4aParams = (): Stage4aParams => ({
  claimsPath: join(dir, "claims.json"),
  factsPath: join(dir, "facts.json"),
  auditPath: join(dir, "audit.json"),
  rolesConfigPath: "config/roles/sales.json",
  auditDate: "2026-10-09",
  geography: "Москва",
  candidateName: "Иван",
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "contracts-hash-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("C3/C4: хеши audit.json и инвалидация документов", () => {
  it("audit до facts.json: пустые хеши + warning", async () => {
    const result = await runStage3a({
      claimsPath: join(dir, "claims.json"),
      auditPath: join(dir, "audit.json"),
      claims: [resultClaim],
      auditDate: "2026-10-09",
      roles: ["sales"],
    });
    const stored = JSON.parse(await readFile(join(dir, "audit.json"), "utf8")) as {
      facts_hash: string;
      meta_hash: string;
    };

    expect(stored.facts_hash).toBe("");
    expect(stored.meta_hash).toBe("");
    expect(result.warnings.some((warning) => warning.kind === "audit_before_facts")).toBe(true);
  });

  it("audit с facts.json: хеши заполнены", async () => {
    await writeFile(join(dir, "facts.json"), JSON.stringify(validFacts), "utf8");

    await runStage3a({
      claimsPath: join(dir, "claims.json"),
      auditPath: join(dir, "audit.json"),
      claims: [resultClaim],
      auditDate: "2026-10-09",
      roles: ["sales"],
      factsPath: join(dir, "facts.json"),
    });
    const stored = JSON.parse(await readFile(join(dir, "audit.json"), "utf8")) as {
      facts_hash: string;
      meta_hash: string;
    };

    expect(stored.facts_hash).toBe(hashFacts(validFacts));
    expect(stored.meta_hash).toBe(hashMeta(validFacts));
  });

  it("stage4a после записи facts.json обновляет audit.json хешами", async () => {
    await writeFile(join(dir, "claims.json"), JSON.stringify({ claims: [employmentClaim] }), "utf8");
    await writeFile(join(dir, "audit.json"), JSON.stringify(emptyAudit()), "utf8");

    const result = await runStage4a(stage4aParams());
    const stored = JSON.parse(await readFile(join(dir, "audit.json"), "utf8")) as {
      facts_hash: string;
      meta_hash: string;
    };

    expect(result.written).toBe(true);
    expect(stored.facts_hash).toBe(hashFacts(result.facts));
    expect(stored.meta_hash).toBe(hashMeta(result.facts));
  });

  it("stage4a помечает stale-документы с прежним hash", async () => {
    await writeFile(join(dir, "claims.json"), JSON.stringify({ claims: [employmentClaim] }), "utf8");

    const rootDir = join(dir, "data");
    const stageStatePath = join(rootDir, "workspaces", "ws1", "stage-state.json");

    await mkdir(join(rootDir, "workspaces", "ws1"), { recursive: true });
    await writeFile(
      stageStatePath,
      JSON.stringify({
        run_id: "run1",
        stages: {},
        documents: { hh_v1_sales: { facts_hash: "sha256:старый", stale: false } },
      }),
      "utf8",
    );

    const result = await runStage4a({
      ...stage4aParams(),
      storageConfig: { rootDir },
      slug: "ws1",
    });
    const state = JSON.parse(await readFile(stageStatePath, "utf8")) as {
      documents: Record<string, { facts_hash: string; stale: boolean }>;
    };

    expect(result.written).toBe(true);
    expect(state.documents["hh_v1_sales"]?.stale).toBe(true);
    expect(state.documents["hh_v1_sales"]?.facts_hash).toBe(hashFacts(result.facts));
  });
});
