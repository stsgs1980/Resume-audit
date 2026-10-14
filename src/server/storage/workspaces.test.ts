import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkspaceExistsError } from "./errors";
import type { StorageConfig } from "./paths";
import { getWorkspaceDir } from "./paths";
import { createWorkspace, deleteWorkspace, listWorkspaces, pathExists, workspaceExists } from "./workspaces";

let dir = "";
let config: StorageConfig = { rootDir: "" };

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "storage-ws-"));
  config = { rootDir: dir };
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("createWorkspace", () => {
  it("создаёт папку и подпапки evidence/, resumes/", async () => {
    await createWorkspace(config, "stas-2026");

    const ws = getWorkspaceDir(config, "stas-2026");

    expect(await pathExists(ws)).toBe(true);
    expect(await pathExists(join(ws, "evidence"))).toBe(true);
    expect(await pathExists(join(ws, "resumes"))).toBe(true);
  });

  it("существующий slug -> throw WorkspaceExistsError", async () => {
    await createWorkspace(config, "stas-2026");

    await expect(createWorkspace(config, "stas-2026")).rejects.toThrow(WorkspaceExistsError);
  });

  it("невалидный slug -> throw", async () => {
    await expect(createWorkspace(config, "../evil")).rejects.toThrow();
  });
});

describe("listWorkspaces", () => {
  it("пустой -> []", async () => {
    expect(await listWorkspaces(config)).toEqual([]);
  });

  it("игнорирует файлы, оставляет только папки", async () => {
    await createWorkspace(config, "ws-a");
    await writeFile(join(dir, "workspaces", "note.txt"), "x", "utf8");

    expect(await listWorkspaces(config)).toEqual(["ws-a"]);
  });
});

describe("workspaceExists / deleteWorkspace", () => {
  it("false до создания, true после", async () => {
    expect(await workspaceExists(config, "ws-a")).toBe(false);

    await createWorkspace(config, "ws-a");

    expect(await workspaceExists(config, "ws-a")).toBe(true);
  });

  it("delete удаляет workspace", async () => {
    await createWorkspace(config, "ws-a");

    await deleteWorkspace(config, "ws-a");

    expect(await workspaceExists(config, "ws-a")).toBe(false);
    expect(await pathExists(join(dir, "workspaces"))).toBe(true);
  });
});
