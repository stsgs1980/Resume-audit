import { z } from "zod";
import { verifyShareSum } from "../../core/verification";
import type { Evidence } from "../../schemas/evidence";
import type { Facts } from "../../schemas/facts";
import { readJson, writeJsonAtomic } from "./files";
import type { StorageConfig } from "./paths";
import { getLockPath } from "./paths";

/**
 * Состояние фактов: черновик или зафиксированы, с временем блокировки.
 * Формат единый для storage и pipeline (см. stage4/lock.ts tryLock).
 */
export interface LockState {
  /** Состояние: черновик или зафиксированы. */
  state: "draft" | "locked";
  /** Время блокировки в ISO 8601, null если draft. */
  lockedAt: string | null;
}

const lockStateSchema = z.object({
  state: z.enum(["draft", "locked"]),
  lockedAt: z.string().nullable(),
});

/** Legacy-формат: голая строка (читается, но больше не пишется). */
const legacyLockStateSchema = z.enum(["draft", "locked"]);

/** Итог проверки возможности перехода в locked. */
export interface LockCheck {
  /** true, если переход разрешён. */
  ok: boolean;
  /** Причины запрета, пусто при ok. */
  reasons: string[];
}

/**
 * Читает состояние фактов. Файла нет — draft без времени.
 * Legacy-строка "draft"/"locked" читается как объект без времени.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @returns состояние фактов
 */
export async function readLockState(config: StorageConfig, slug: string): Promise<LockState> {
  let state: unknown;

  try {
    state = await readJson(getLockPath(config, slug), z.unknown());
  } catch (error) {
    if ((error as Error).name === "FileNotFoundError") {
      return { state: "draft", lockedAt: null };
    }

    throw error;
  }

  const parsed = lockStateSchema.safeParse(state);

  if (parsed.success) {
    return parsed.data;
  }

  const legacy = legacyLockStateSchema.safeParse(state);

  if (legacy.success) {
    return { state: legacy.data, lockedAt: null };
  }

  throw new Error(`Invalid lock state in workspace "${slug}"`);
}

/**
 * Записывает состояние фактов атомарно.
 *
 * @param config - конфиг хранилища
 * @param slug - slug workspace
 * @param state - новое состояние
 * @returns void
 */
export async function writeLockState(config: StorageConfig, slug: string, state: LockState): Promise<void> {
  await writeJsonAtomic(getLockPath(config, slug), state);
}

/**
 * Проверяет условия перехода draft -> locked.
 *
 * @param facts - факты из facts.json
 * @param evidence - карточки доказательств (по умолчанию нет)
 * @returns итог с причинами запрета
 */
export function canLock(facts: Facts, evidence: Evidence[] = []): LockCheck {
  const reasons: string[] = [];

  for (const job of facts.jobs) {
    for (const result of job.results ?? []) {
      if (result.status === "needs_evidence") {
        reasons.push(`open needs_evidence: ${result.id}`);
      }
    }
  }

  for (const card of evidence) {
    if (card.status !== "confirmed") {
      reasons.push(`evidence not confirmed: ${card.fact_id}`);
    }
  }

  const shares = facts.meta.targets.map((target) => target.share_of_applications);

  if (!verifyShareSum(shares)) {
    const sum = shares.reduce((total, share) => total + share, 0);

    reasons.push(`share_of_applications sum ${sum} outside [0.99, 1.01]`);
  }

  return { ok: reasons.length === 0, reasons };
}
