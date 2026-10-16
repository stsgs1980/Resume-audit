import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Facts } from "../../schemas/facts";
import { factsSchema } from "../../schemas/facts";
import { readLockState } from "../../server/storage/lock";
import { getLockPath } from "../../server/storage/paths";
import { runStage1 } from "../stage1/index";
import { runStage2 } from "../stage2/index";
import type { Claim } from "../stage2/types";
import { runStage3, runStage3a } from "../stage3/index";
import { runStage4a } from "../stage4/index";
import { runStage4b } from "../stage4/review";
import { evidenceValues, inputFor, mockClient, resumeText } from "./pipeline-fixtures";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "pipeline-it-"));
  await writeFile(join(dir, "resume.md"), resumeText, "utf8");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("pipeline stages 1-4", () => {
  it("end-to-end: факты валидны, lock читается, evidence сходится", async () => {
    const inputDir = join(dir, "input");
    const filesPath = join(dir, "files.json");
    const claimsPath = join(dir, "claims.json");
    const auditPath = join(dir, "audit.json");
    const factsPath = join(dir, "facts.json");
    const evidenceDir = join(dir, "evidence");
    const answersPath = join(dir, "answers");
    const storage = { rootDir: dir };
    const lockPath = getLockPath(storage, "it");
    const promptConfig = { promptsDir: "config/prompts" };
    const client = mockClient();

    await mkdir(inputDir, { recursive: true });
    await writeFile(join(inputDir, "resume.md"), resumeText, "utf8");

    const stage1 = await runStage1({ rootDir: inputDir, outputPath: filesPath });

    expect(stage1.errors).toEqual([]);

    const stage2 = await runStage2({
      filesPath,
      claimsPath,
      llmClient: client,
      promptConfig,
      partialDir: join(dir, "partial"),
    });

    expect(stage2.totalClaims).toBe(2);

    await runStage3({
      claimsPath,
      auditPath,
      claims: [],
      auditDate: "2026-10-09",
      roles: ["sales"],
      rolesConfigPath: "config/roles/sales.json",
      llmClient: client,
      promptConfig,
      vacancyText: null,
    });

    const stage4a = await runStage4a({
      claimsPath,
      factsPath,
      auditPath,
      rolesConfigPath: "config/roles/sales.json",
      auditDate: "2026-10-09",
      geography: "Москва",
      candidateName: "Иван",
    });

    expect(stage4a.written).toBe(true);

    const facts = JSON.parse(await readFile(factsPath, "utf8")) as Facts;

    expect(factsSchema.safeParse(facts).success).toBe(true);

    const stage4b = await runStage4b({
      workspaceDir: dir,
      auditPath,
      factsPath,
      evidenceDir,
      lockPath,
      answersPath,
      inputFn: inputFor([...evidenceValues]),
      outputFn: () => undefined,
    });

    expect(stage4b.locked).toBe(true);

    const lock = await readLockState(storage, "it");

    expect(lock.state).toBe("locked");
    expect(typeof lock.lockedAt).toBe("string");

    const checked = JSON.parse(await readFile(factsPath, "utf8")) as Facts;
    const files = new Set(await readdir(evidenceDir));

    expect(checked.jobs.length).toBeGreaterThan(0);
    expect(stage4b.evidenceWritten).toContain("res1");

    for (const job of checked.jobs) {
      for (const result of job.results ?? []) {
        expect(files.has(`${result.evidence_id}.json`)).toBe(true);
        expect(result.roles.length).toBeGreaterThan(0);
        expect(typeof result.hedge_required).toBe("boolean");
      }
    }
  });
});

describe("эвристики этапа 4 (группа D)", () => {
  const employment = (id: string, company: string, period: string): Claim => ({
    id,
    statement: `работал руководителем отдела продаж в компании ${company}`,
    quote: `работал в компании ${company} с ${period}`,
    source_file: "resume.md",
    category: "employment",
    metric_type: "",
    number: null,
    currency: null,
    status: "confirmed",
    reason: "",
  });

  it("голый год в цитате не создаёт job с датой 2000-01", async () => {
    const claimsPath = join(dir, "claims.json");
    const factsPath = join(dir, "facts.json");
    const auditPath = join(dir, "audit.json");

    await writeFile(
      claimsPath,
      JSON.stringify({
        claims: [
          {
            ...employment("claim1", "Ромашка", "2020-01 по 2021-01"),
            statement: "работал в компании Ромашка",
            quote: "работал в компании Ромашка, привлёк 2000 клиентов за год",
          },
        ],
      }),
      "utf8",
    );

    const result = await runStage4a({
      claimsPath,
      factsPath,
      auditPath,
      rolesConfigPath: "config/roles/sales.json",
      auditDate: "2026-10-09",
    });
    const stored = JSON.parse(await readFile(factsPath, "utf8")) as Facts;

    expect(result.facts.jobs).toEqual([]);
    expect(stored.jobs).toEqual([]);
    expect(result.warnings.some((warning) => warning.code === "no_dates")).toBe(true);
  });

  it("две разные компании не дают ложного date_mismatch", async () => {
    const claimsPath = join(dir, "claims.json");
    const auditPath = join(dir, "audit.json");

    await writeFile(
      claimsPath,
      JSON.stringify({
        claims: [
          employment("claim1", "Ромашка", "2020-01 по 2021-01"),
          employment("claim2", "Лютик", "2022-01 по 2023-01"),
        ],
      }),
      "utf8",
    );

    const result = await runStage3a({
      claimsPath,
      auditPath,
      claims: [],
      auditDate: "2026-10-09",
      roles: [],
    });
    const stored = JSON.parse(await readFile(auditPath, "utf8")) as { contradictions: Array<{ kind: string }> };

    expect(result.contradictions).toEqual([]);
    expect(stored.contradictions.some((item) => item.kind === "date_mismatch")).toBe(false);
  });
});
