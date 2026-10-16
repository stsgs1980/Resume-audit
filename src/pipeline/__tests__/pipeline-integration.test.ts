import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LlmClient } from "../../llm/client";
import type { ExtractionResponse, RolesResponse } from "../../llm/schemas";
import type { LlmCallResult } from "../../llm/types";
import type { Facts } from "../../schemas/facts";
import { factsSchema } from "../../schemas/facts";
import { readLockState } from "../../server/storage/lock";
import { getLockPath } from "../../server/storage/paths";
import { runStage1 } from "../stage1/index";
import { runStage2 } from "../stage2/index";
import { runStage3 } from "../stage3/index";
import { runStage4a } from "../stage4/index";
import { runStage4b } from "../stage4/review";

let dir = "";

const resumeText = [
  "Иван Иванов, руководитель отдела продаж.",
  "Работал в компании Ромашка с 2020-01 по 2021-01.",
  "По учёту выручка выросла на 4,2 млн руб.",
].join("\n");

const rawClaims: ExtractionResponse["claims"] = [
  {
    statement: "работал в компании Ромашка руководителем",
    quote: "работал в компании Ромашка с 2020-01 по 2021-01",
    source_file: "resume.md",
    category: "employment",
    metric_type: "",
    number: null,
    currency: null,
    status: "confirmed",
    reason: "",
  },
  {
    statement: "Выручка компании Ромашка выросла на 4,2 млн",
    quote: "по учёту выручка выросла на 4,2 млн руб",
    source_file: "resume.md",
    category: "result",
    metric_type: "выручка",
    number: 4200000,
    currency: "RUB",
    status: "needs_evidence",
    reason: "",
  },
];

const rolesPayload: RolesResponse = {
  roles: [
    {
      role_id: "sales",
      scores: {
        experience_fit: 8,
        responsibility_level: 8,
        measurable_results: 7,
        keyword_fit: 7,
        hr_screen: 8,
        hiring_manager: 7,
      },
      total: 45,
      strengths: ["опыт"],
      gaps: [],
      overpositioning_risk: 2,
      recommendation: "подходит",
    },
  ],
};

/**
 * Mock-клиент: extraction и roles по stage.
 *
 * @returns клиент
 */
const mockClient = (): LlmClient => ({
  health: () => Promise.resolve(true),
  call: <T>(callParams: { stage?: string }): Promise<LlmCallResult<T>> => {
    if (callParams.stage === "roles") {
      return Promise.resolve({ ok: true, data: rolesPayload as unknown as T });
    }

    return Promise.resolve({ ok: true, data: { claims: rawClaims } as unknown as T });
  },
});

const evidenceValues = [
  "resume.md",
  "выручка выросла",
  "выручка направления",
  "учёт 2023 минус учёт 2022",
  "2023-01 - 2023-12",
  "база 2022 года",
  "управленческий учёт",
  "направление, 4 менеджера",
];

/**
 * Ввод 4b: поля карточки по очереди, остальное свободной строкой.
 *
 * @param queue - значения полей карточки
 * @returns функция ввода
 */
const inputFor = (queue: string[]): ((prompt: string) => Promise<string>) => {
  return (prompt: string) => {
    if (prompt.startsWith("Ответ (или")) {
      return Promise.resolve("подтверждаю");
    }

    return Promise.resolve(queue.shift() ?? "значение");
  };
};

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
