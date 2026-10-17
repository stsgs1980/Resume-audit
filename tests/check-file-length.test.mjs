import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const probeName = "tmp-length-probe-300.ts";
const probePath = join(repoRoot, probeName);

/**
 * Запускает check-file-length.ts как дочерний процесс.
 * stderr явно переведён в pipe, чтобы ожидаемые падения
 * не попадали в общий вывод тестов.
 *
 * @param {string[]} args - аргументы скрипта
 * @returns {string} stdout процесса
 */
const runCheck = (args) =>
  execFileSync("node", ["scripts/check-file-length.ts", ...args], { encoding: "utf8", cwd: repoRoot, stdio: "pipe" });

/**
 * Запускает проверку, ожидая падение. Exit code и stderr проверяются
 * как значения, а не через вывод в консоль.
 *
 * @param {string[]} args - аргументы скрипта
 * @returns {Error & { status?: number; stderr?: string }} ошибка дочернего процесса
 */
const runCheckExpectingFailure = (args) => {
  try {
    runCheck(args);
  } catch (error) {
    return error;
  }

  throw new Error("check-file-length должен был упасть, но прошёл");
};

const writeProbe = (lines) => writeFileSync(probePath, `${"// length probe\n".repeat(lines)}`);

const removeProbe = () => rmSync(probePath, { force: true });

describe("check-file-length untracked files", () => {
  it("untracked файл на 300 строк роняет проверку --all", () => {
    writeProbe(300);

    try {
      const error = runCheckExpectingFailure(["--all"]);

      expect(error.status).toBe(1);
      expect(String(error.stderr)).toContain("[FAIL] File 'tmp-length-probe-300.ts'");
      expect(String(error.stderr)).toContain("[Anti-Monolith] Commit rejected.");
    } finally {
      removeProbe();
    }
  });

  it("untracked файл на 300 строк роняет pre-commit режим", () => {
    writeProbe(300);

    try {
      const error = runCheckExpectingFailure([]);

      expect(error.status).toBe(1);
      expect(String(error.stderr)).toContain("[FAIL] File 'tmp-length-probe-300.ts'");
      expect(String(error.stderr)).toContain("[Anti-Monolith] Commit rejected.");
    } finally {
      removeProbe();
    }
  });

  it("без probe проверка --all проходит", () => {
    removeProbe();

    expect(() => runCheck(["--all"])).not.toThrow();
  });
});
