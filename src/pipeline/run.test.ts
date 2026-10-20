import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  baseParams,
  exists,
  fullClient,
  prepareLockedFacts,
  setupInput,
  stageStatus,
  validDocument,
} from "./__tests__/run-harness";
import { runPipeline } from "./run";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "pipeline-run-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runPipeline()", () => {
  it("skipLlmStages -> 1,3,4 выполнены, 2,5,7,8 пропущены, partial", async () => {
    await setupInput(dir);

    const result = await runPipeline(baseParams(dir, null, true));

    expect(stageStatus(result, "1")).toBe("completed");
    expect(stageStatus(result, "2")).toBe("skipped");
    expect(stageStatus(result, "3")).toBe("completed");
    expect(stageStatus(result, "4")).toBe("completed");
    expect(stageStatus(result, "5")).toBe("skipped");
    expect(stageStatus(result, "7")).toBe("skipped");
    expect(stageStatus(result, "8")).toBe("skipped");
    expect(result.overallStatus).toBe("partial");

    expect(await exists(join(dir, "workspace", "files.json"))).toBe(true);
    expect(await exists(join(dir, "workspace", "audit.json"))).toBe(true);
    expect(await exists(join(dir, "workspace", "facts.json"))).toBe(true);
  });

  it("llmClient = null -> LLM-этапы пропущены", async () => {
    await setupInput(dir);

    const result = await runPipeline(baseParams(dir, null));

    expect(stageStatus(result, "2")).toBe("skipped");
    expect(stageStatus(result, "7")).toBe("skipped");
    expect(stageStatus(result, "8")).toBe("skipped");
    expect(result.artifacts.filesJson).not.toBeNull();
    expect(result.artifacts.auditJson).not.toBeNull();
    expect(result.artifacts.factsJson).not.toBeNull();
  });

  it("мок-LLM и locked facts -> этапы 2,7,8 выполнены, success", async () => {
    await setupInput(dir);
    await prepareLockedFacts(dir);

    const result = await runPipeline(baseParams(dir, fullClient()));

    expect(stageStatus(result, "2")).toBe("completed");
    expect(stageStatus(result, "7")).toBe("completed");
    expect(stageStatus(result, "8")).toBe("completed");
    expect(result.overallStatus).toBe("success");
    expect(result.artifacts.resumes).toHaveLength(3);
    expect(result.artifacts.validation).toHaveLength(3);
    expect(result.artifacts.defenseMd).not.toBeNull();
  });

  it("частичный сбой stage7 -> версии stale, stage8 пропущен", async () => {
    await setupInput(dir);
    await prepareLockedFacts(dir);

    const result = await runPipeline(baseParams(dir, fullClient({ failStages: ["generation_aipo"] })));
    const state = JSON.parse(await readFile(join(dir, "workspace", "stage-state.json"), "utf8")) as {
      documents: Record<string, { stale: boolean }>;
    };

    expect(stageStatus(result, "7")).toBe("failed");
    expect(stageStatus(result, "8")).toBe("skipped");
    expect(state.documents["hh_v1_sales"]?.stale).toBe(true);
    expect(state.documents["hh_v1_salesops"]?.stale).toBe(true);
  });

  it("мок-LLM без lock -> этапы 7 и 8 пропущены", async () => {
    await setupInput(dir);

    const result = await runPipeline(baseParams(dir, fullClient()));

    expect(stageStatus(result, "7")).toBe("skipped");
    expect(stageStatus(result, "8")).toBe("skipped");
    expect(result.overallStatus).toBe("partial");
  });

  it("blocked-версии -> этап 8 failed, overall partial", async () => {
    await setupInput(dir);
    await prepareLockedFacts(dir);

    const emptyDocument = (stage?: string): Record<string, unknown> => ({
      ...validDocument(stage),
      jobs: [],
      skills: [],
    });
    const result = await runPipeline(baseParams(dir, fullClient({ document: emptyDocument })));

    expect(stageStatus(result, "7")).toBe("completed");
    expect(stageStatus(result, "8")).toBe("failed");
    expect(result.overallStatus).toBe("partial");
    expect(result.stages.find((stage) => stage.id === "8")?.error).toContain("заблокирован");
  });
});
