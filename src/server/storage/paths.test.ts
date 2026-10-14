import { resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import type { StorageConfig } from "./paths";
import {
  ensureWithinRoot,
  getAuditPath,
  getClaimsPath,
  getEvidenceDir,
  getEvidencePath,
  getFactsPath,
  getLockPath,
  getResumePath,
  getResumesDir,
  getStageStatePath,
  getValidationPath,
  getWorkspaceDir,
} from "./paths";

const config: StorageConfig = { rootDir: "data" };

describe("Test 22 (security): slug с обходом пути отклоняется", () => {
  it('"../../../etc/passwd" -> throw', () => {
    expect(() => getWorkspaceDir(config, "../../../etc/passwd")).toThrow();
  });

  it('slug с "/" -> throw', () => {
    expect(() => getWorkspaceDir(config, "a/b")).toThrow();
  });

  it('slug с ".." -> throw', () => {
    expect(() => getWorkspaceDir(config, "..")).toThrow();
  });

  it("пустой slug -> throw", () => {
    expect(() => getWorkspaceDir(config, "")).toThrow();
  });

  it("заглавные буквы в slug -> throw", () => {
    expect(() => getWorkspaceDir(config, "Stas")).toThrow();
  });
});

describe("getWorkspaceDir: валидные slug", () => {
  it('"stas-2026" -> <root>/workspaces/stas-2026', () => {
    const dir = getWorkspaceDir(config, "stas-2026");

    expect(dir).toBe(resolve("data", "workspaces", "stas-2026"));
  });
});

describe("ensureWithinRoot", () => {
  it("отклоняет путь вне root", () => {
    const outside = resolve("data", "..", "evil.json");

    expect(() => ensureWithinRoot(resolve("data"), outside)).toThrow();
  });

  it("принимает путь внутри root", () => {
    const root = resolve("data");
    const inside = resolve("data", "workspaces", "a", "facts.json");

    expect(ensureWithinRoot(root, inside)).toBe(inside);
  });

  it("отклоняет sibling с общим префиксом имени", () => {
    const root = resolve("data");
    const sibling = `${root}-backup${sep}facts.json`;

    expect(() => ensureWithinRoot(root, sibling)).toThrow();
  });
});

describe("getters: пути внутри workspace", () => {
  it("все пути лежат внутри workspace", () => {
    const ws = getWorkspaceDir(config, "stas-2026");
    const paths = [
      getFactsPath(config, "stas-2026"),
      getEvidenceDir(config, "stas-2026"),
      getEvidencePath(config, "stas-2026", "res1"),
      getAuditPath(config, "stas-2026"),
      getClaimsPath(config, "stas-2026"),
      getValidationPath(config, "stas-2026"),
      getStageStatePath(config, "stas-2026"),
      getResumesDir(config, "stas-2026"),
      getResumePath(config, "stas-2026", "hh_v1_sales"),
      getLockPath(config, "stas-2026"),
    ];

    for (const filePath of paths) {
      expect(filePath.startsWith(`${ws}${sep}`) || filePath === ws).toBe(true);
    }
  });

  it("evidence path с traversal в factId -> throw", () => {
    expect(() => getEvidencePath(config, "stas-2026", "../evil")).toThrow();
  });
});
