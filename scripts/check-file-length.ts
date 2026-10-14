#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const DEFAULT_MAX_LINES = 250;
const EXTENSIONS = /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/;

const args = process.argv.slice(2);
const checkAll = args.includes("--all");
const maxLinesArg = args.find((arg) => arg.startsWith("--max-lines="));

/**
 * Parse and strictly validate the --max-lines flag.
 * @param raw - raw flag value without the prefix
 * @returns validated line limit
 */
function parseMaxLines(raw: string | undefined): number {
  if (raw === undefined) {
    return DEFAULT_MAX_LINES;
  }

  const parsed = Number(raw.slice("--max-lines=".length));

  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.error(`[FAIL] Invalid --max-lines value: '${raw}'. Expected a positive integer.`);
    process.exit(2);
  }

  return parsed;
}

const MAX_LINES = parseMaxLines(maxLinesArg);

/**
 * Pre-commit check by default (staged files), full-tree check with --all.
 * @returns {string[]} file paths to check
 */
function listFiles() {
  const command = checkAll ? "git ls-files" : "git diff --cached --name-only --diff-filter=ACM";

  return execSync(command, { encoding: "utf8" })
    .split("\n")
    .map((file) => file.trim())
    .filter((file) => EXTENSIONS.test(file));
}

/**
 * Anti-monolith check: TS/JS files must not exceed MAX_LINES.
 * @returns {void}
 */
function main() {
  const files = listFiles();

  let failed = 0;

  for (const file of files) {
    if (!existsSync(file)) {
      continue;
    }

    const lines = readFileSync(file, "utf8").split("\n").length;

    if (lines > MAX_LINES) {
      console.error(`[FAIL] File '${file}' has ${lines} lines. Limit: ${MAX_LINES}.`);
      failed = 1;
    }
  }

  if (failed) {
    console.error("[Anti-Monolith] Commit rejected.");
    process.exit(1);
  }

  console.log(`[OK] Checked files: ${files.length}. Limit: ${MAX_LINES} lines.`);
}

main();
