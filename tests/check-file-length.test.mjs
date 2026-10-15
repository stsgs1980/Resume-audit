import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const probeName = "tmp-length-probe-300.ts";
const probePath = join(repoRoot, probeName);

const runCheck = (args) =>
  execFileSync("node", ["scripts/check-file-length.ts", ...args], { encoding: "utf8", cwd: repoRoot });

const writeProbe = (lines) => writeFileSync(probePath, `${"// length probe\n".repeat(lines)}`);

const removeProbe = () => rmSync(probePath, { force: true });

describe("check-file-length untracked files", () => {
  it("untracked файл на 300 строк роняет проверку --all", () => {
    writeProbe(300);

    try {
      expect(() => runCheck(["--all"])).toThrow();
    } finally {
      removeProbe();
    }
  });

  it("untracked файл на 300 строк роняет pre-commit режим", () => {
    writeProbe(300);

    try {
      expect(() => runCheck([])).toThrow();
    } finally {
      removeProbe();
    }
  });

  it("без probe проверка --all проходит", () => {
    removeProbe();

    expect(() => runCheck(["--all"])).not.toThrow();
  });
});
