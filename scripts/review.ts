import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { runStage4b } from "../src/pipeline/stage4/review.ts";

/**
 * Определяет workspace: env или первый из data/workspaces/.
 *
 * @returns путь к workspace или null
 */
async function resolveWorkspace(): Promise<string | null> {
  if (process.env["RESUME_AUDIT_WORKSPACE"] !== undefined) {
    return process.env["RESUME_AUDIT_WORKSPACE"];
  }

  try {
    const names = await readdir("data/workspaces", { withFileTypes: true });
    const first = names.find((entry) => entry.isDirectory());

    return first === undefined ? null : join("data", "workspaces", first.name);
  } catch {
    return null;
  }
}

/**
 * Точка входа CLI этапа 4b.
 */
async function main(): Promise<void> {
  const workspaceDir = await resolveWorkspace();

  if (workspaceDir === null) {
    console.log("Нет workspace в data/workspaces/. Сначала импортируйте данные.");

    process.exitCode = 1;

    return;
  }

  const result = await runStage4b({
    workspaceDir,
    auditPath: join(workspaceDir, "audit.json"),
    factsPath: join(workspaceDir, "facts.json"),
    evidenceDir: join(workspaceDir, "evidence"),
    lockPath: join(workspaceDir, "facts.lock"),
    answersPath: join(workspaceDir, "answers"),
  });

  console.log(
    `Готово: отвечено ${result.answersProcessed}, отложено ${result.answersDeferred}, ` +
      `отклонено ${result.answersRejected}, locked: ${result.locked}`,
  );

  if (!result.locked) {
    console.log(`Причины: ${result.lockReasons.join("; ")}`);
  }
}

await main();
