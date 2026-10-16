import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureLocked } from "./check-lock";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stage7-lock-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("ensureLocked()", () => {
  it("файла нет -> ok false", async () => {
    const result = await ensureLocked(join(dir, "facts.lock"));

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("locked");
  });

  it("state locked -> ok true", async () => {
    const lockPath = join(dir, "facts.lock");

    await writeFile(lockPath, JSON.stringify({ state: "locked", lockedAt: "" }), "utf8");

    expect(await ensureLocked(lockPath)).toEqual({ ok: true, reason: null });
  });

  it("state draft -> ok false", async () => {
    const lockPath = join(dir, "facts.lock");

    await writeFile(lockPath, JSON.stringify({ state: "draft" }), "utf8");

    const result = await ensureLocked(lockPath);

    expect(result.ok).toBe(false);
  });
});
