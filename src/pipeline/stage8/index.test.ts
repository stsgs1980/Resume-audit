import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeDocument, makeFacts, mockClient, setupStage8, stage8Params } from "./__tests__/harness";
import { runStage8 } from "./index";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage8-run-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runStage8()", () => {
  it("facts не locked -> 0 validated, errors", async () => {
    await setupStage8(dir, makeFacts(), {}, false);

    const result = await runStage8(stage8Params(dir, mockClient()));

    expect(result.validated).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("одна версия с ошибками -> blocked true", async () => {
    await setupStage8(dir, makeFacts(), { hh_v1_sales: makeDocument("Сделка на 7,5 млрд RUB") }, true);

    const result = await runStage8(stage8Params(dir, mockClient()));

    expect(result.validated).toHaveLength(1);
    expect(result.validated[0]?.blocked).toBe(true);
    expect(result.exportBlocked).toBe(true);
  });

  it("две версии ok -> exportBlocked false", async () => {
    await setupStage8(
      dir,
      makeFacts(),
      {
        hh_v1_sales: makeDocument("выручка 4,2 млн"),
        hh_v1_salesops: makeDocument("выручка 4,2 млн"),
      },
      true,
    );

    const result = await runStage8(stage8Params(dir, mockClient()));

    expect(result.validated).toHaveLength(2);
    expect(result.exportBlocked).toBe(false);
  });

  it("versionIds ограничивает проверку свежими версиями", async () => {
    await setupStage8(
      dir,
      makeFacts(),
      {
        hh_v1_sales: makeDocument("выручка 4,2 млн"),
        hh_v1_salesops: makeDocument("выручка 4,2 млн"),
      },
      true,
    );

    const result = await runStage8({
      ...stage8Params(dir, mockClient()),
      versionIds: ["hh_v1_sales", "hh_v1_missing"],
    });
    const stale = await readFile(join(dir, "validation", "hh_v1_salesops.json"), "utf8").catch(() => null);
    const state = JSON.parse(await readFile(join(dir, "stage-state.json"), "utf8")) as {
      stages: Record<string, { status: string }>;
    };

    expect(result.validated).toHaveLength(1);
    expect(result.validated[0]?.versionId).toBe("hh_v1_sales");
    expect(result.errors.some((entry) => entry.versionId === "hh_v1_missing")).toBe(true);
    expect(stale).toBeNull();
    expect(state.stages["verification"]?.status).toBe("failed");
  });

  it("validation/*.json записаны", async () => {
    await setupStage8(dir, makeFacts(), { hh_v1_sales: makeDocument("выручка 4,2 млн") }, true);

    await runStage8(stage8Params(dir, mockClient()));

    const stored = JSON.parse(await readFile(join(dir, "validation", "hh_v1_sales.json"), "utf8")) as {
      versionId: string;
      blocked: boolean;
    };

    expect(stored.versionId).toBe("hh_v1_sales");
    expect(typeof stored.blocked).toBe("boolean");
  });

  it("stage-state.json обновлён", async () => {
    await setupStage8(dir, makeFacts(), { hh_v1_sales: makeDocument("выручка 4,2 млн") }, true);

    await runStage8(stage8Params(dir, mockClient()));

    const stored = JSON.parse(await readFile(join(dir, "stage-state.json"), "utf8")) as {
      documents: Record<string, { stale: boolean }>;
    };

    expect(typeof stored.documents["hh_v1_sales"]?.stale).toBe("boolean");
  });
});
