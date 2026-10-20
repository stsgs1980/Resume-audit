import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LlmClient } from "../llm/client";
import type { LlmCallResult } from "../llm/types";
import { baseParams, fullClient, markLocked, runClaims, setupInput, stageStatus } from "./__tests__/run-harness";
import { runPipeline } from "./run";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "pipeline-guards-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runPipeline(): зависимости этапов", () => {
  it("этап 1 failed -> этапы 3 и 4 пропущены", async () => {
    const result = await runPipeline(baseParams(dir, null, true));

    expect(stageStatus(result, "1")).toBe("failed");
    expect(stageStatus(result, "2")).toBe("skipped");
    expect(stageStatus(result, "3")).toBe("skipped");
    expect(stageStatus(result, "4")).toBe("skipped");
    expect(result.overallStatus).toBe("failed");
  });

  it("ошибка roles на этапе 3b -> этап 3 failed", async () => {
    await setupInput(dir);

    const result = await runPipeline(baseParams(dir, fullClient({ failRoles: true })));
    const stage3 = result.stages.find((stage) => stage.id === "3");

    expect(stage3?.status).toBe("failed");
    expect(stage3?.error).toContain("roles");
    expect(result.overallStatus).toBe("failed");
  });

  it("этап 2 failed -> этап 4 пропущен, facts не создан", async () => {
    await setupInput(dir);
    const failing: LlmClient = {
      health: () => Promise.resolve(true),
      call: <T>(): Promise<LlmCallResult<T>> =>
        Promise.resolve({ ok: false, error: { kind: "unavailable", message: "boom" } }),
    };

    const result = await runPipeline(baseParams(dir, failing));

    expect(stageStatus(result, "2")).toBe("failed");
    expect(stageStatus(result, "4")).toBe("skipped");
    expect(stageStatus(result, "7")).toBe("skipped");
    expect(result.artifacts.factsJson).toBeNull();
  });
});

describe("runPipeline(): сохранность facts и lock", () => {
  it("claims.json отсутствует -> существующий facts.json не перезаписан", async () => {
    await setupInput(dir);
    const factsPath = join(dir, "workspace", "facts.json");

    await writeFile(factsPath, JSON.stringify({ marker: "keep" }), "utf8");

    const result = await runPipeline(baseParams(dir, null, true));
    const stored = JSON.parse(await readFile(factsPath, "utf8")) as { marker?: string };

    expect(stageStatus(result, "4")).toBe("failed");
    expect(stored.marker).toBe("keep");
    expect(result.stages.find((stage) => stage.id === "4")?.warnings).toContain(
      "claims_missing: claims.json не найден",
    );
  });

  it("locked facts с невалидной схемой -> этап 4 failed", async () => {
    await setupInput(dir);
    const factsPath = join(dir, "workspace", "facts.json");

    await writeFile(factsPath, JSON.stringify({ meta: {} }), "utf8");
    await markLocked(dir);

    const result = await runPipeline(baseParams(dir, null, true));
    const stage4 = result.stages.find((stage) => stage.id === "4");

    expect(stageStatus(result, "4")).toBe("failed");
    expect(stage4?.error).toContain("facts.json");
  });

  it("locked facts не пересобираются повторным прогоном", async () => {
    await setupInput(dir);
    await runPipeline(baseParams(dir, fullClient()));

    const factsPath = join(dir, "workspace", "facts.json");
    const facts = JSON.parse(await readFile(factsPath, "utf8")) as { meta: { candidate_name: string } };

    facts.meta.candidate_name = "Иван";
    await writeFile(factsPath, JSON.stringify(facts), "utf8");
    await markLocked(dir);

    const changedClaims = runClaims.map((claim) =>
      claim.category === "employment" ? { ...claim, quote: "работал в компании Лютик с 2020-01 по 2021-01" } : claim,
    );
    const result = await runPipeline(baseParams(dir, fullClient({ claims: changedClaims })));
    const after = JSON.parse(await readFile(factsPath, "utf8")) as { meta: { candidate_name: string } };
    const lock = JSON.parse(await readFile(join(dir, "workspace", "facts.lock"), "utf8")) as { state: string };

    expect(stageStatus(result, "4")).toBe("completed");
    expect(after.meta.candidate_name).toBe("Иван");
    expect(lock.state).toBe("locked");
    expect(stageStatus(result, "7")).toBe("completed");
  });

  it("изменение facts помечает производные документы stale", async () => {
    await setupInput(dir);
    await runPipeline(baseParams(dir, fullClient()));

    const stageStatePath = join(dir, "workspaces", "workspace", "stage-state.json");

    await mkdir(join(dir, "workspaces", "workspace"), { recursive: true });
    await writeFile(
      stageStatePath,
      JSON.stringify({
        run_id: "",
        stages: {},
        documents: { hh_v1_sales: { facts_hash: "sha256:old", stale: false } },
      }),
      "utf8",
    );

    const changedClaims = runClaims.map((claim) =>
      claim.category === "result" ? { ...claim, number: 5000000, quote: "выручка 5 млн" } : claim,
    );
    const params = {
      ...baseParams(dir, fullClient({ claims: changedClaims })),
      storageConfig: { rootDir: dir },
      slug: "workspace",
    };

    await runPipeline(params);

    const state = JSON.parse(await readFile(stageStatePath, "utf8")) as {
      documents: Record<string, { facts_hash: string; stale: boolean }>;
    };

    expect(state.documents["hh_v1_sales"]?.stale).toBe(true);
    expect(state.documents["hh_v1_sales"]?.facts_hash).not.toBe("sha256:old");
  });
});

describe("runPipeline(): устойчивость", () => {
  it("исключение в onProgress не ломает прогон", async () => {
    await setupInput(dir);
    const params = {
      ...baseParams(dir, null, true),
      onProgress: (): void => {
        throw new Error("progress boom");
      },
    };

    const result = await runPipeline(params);

    expect(stageStatus(result, "1")).toBe("completed");
    expect(result.overallStatus).toBe("partial");
  });
});
