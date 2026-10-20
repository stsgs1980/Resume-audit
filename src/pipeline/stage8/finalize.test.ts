import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeDocument, makeFacts, mockClient, setupStage8, stage8Params } from "./__tests__/harness";
import { runStage8 } from "./index";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage8-finalize-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runStage8(): stage-state на error-путях", () => {
  it("все ожидаемые версии отсутствуют -> failed, запись stale", async () => {
    await setupStage8(dir, makeFacts(), { hh_v1_sales: makeDocument("выручка 4,2 млн") }, true);
    await writeFile(
      join(dir, "stage-state.json"),
      JSON.stringify({
        run_id: "",
        stages: {},
        documents: { hh_v1_missing: { facts_hash: "old", stale: false } },
      }),
      "utf8",
    );

    const result = await runStage8({ ...stage8Params(dir, mockClient()), versionIds: ["hh_v1_missing"] });
    const stored = JSON.parse(await readFile(join(dir, "stage-state.json"), "utf8")) as {
      stages: Record<string, { status: string }>;
      documents: Record<string, { stale: boolean }>;
    };

    expect(result.validated).toEqual([]);
    expect(result.exportBlocked).toBe(true);
    expect(stored.stages["verification"]?.status).toBe("failed");
    expect(stored.documents["hh_v1_missing"]?.stale).toBe(true);
  });

  it("facts не locked -> stage-state failed", async () => {
    await setupStage8(dir, makeFacts(), {}, false);

    const result = await runStage8(stage8Params(dir, mockClient()));
    const stored = JSON.parse(await readFile(join(dir, "stage-state.json"), "utf8")) as {
      stages: Record<string, { status: string }>;
    };

    expect(result.exportBlocked).toBe(true);
    expect(stored.stages["verification"]?.status).toBe("failed");
  });
});
