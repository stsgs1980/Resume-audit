import type { Claim } from "../stage2/types";

export type { Claim };

/** Серьёзность противоречия. */
export type ContradictionSeverity = "warning" | "hard";

/** Противоречие между утверждениями. */
export interface Contradiction {
  /** Id вида "contradiction1". */
  id: string;
  /** Вид противоречия. */
  kind: "number_mismatch" | "date_mismatch" | "duration_mismatch" | "skill_conflict";
  /** Серьёзность. */
  severity: ContradictionSeverity;
  /** Связанные claim id. */
  factIds: string[];
  /** Текст на русском. */
  description: string;
  /** Цитаты из claims. */
  evidence: string[];
}

/** Тип открытого вопроса. */
export type QuestionType =
  | "missing_evidence"
  | "contradiction"
  | "ambiguous_date"
  | "parallel_roles"
  | "gap"
  | "currency_missing"
  | "target_vs_measured"
  | "skill_usage"
  | "other";

/** Открытый вопрос этапа 4. */
export interface OpenQuestion {
  /** Id вида "q_001". */
  id: string;
  /** Тип вопроса. */
  type: QuestionType;
  /** Текст вопроса. */
  question: string;
  /** Контекст: к какому факту или файлу. */
  context: string;
  /** Связанные claim id. */
  relatedClaimIds: string[];
  /** Источник: "audit#..." */
  createdFrom: string;
}

/** Предупреждение этапа. */
export interface AuditWarning {
  /** Id вида "warn1". */
  id: string;
  /** Вид для группировки. */
  kind: string;
  /** Текст. */
  message: string;
}

/** Итог этапа 3a. */
export interface Stage3aResult {
  /** Время генерации в ISO 8601. */
  generatedAt: string;
  /** Противоречия. */
  contradictions: Contradiction[];
  /** Открытые вопросы. */
  openQuestions: OpenQuestion[];
  /** Предупреждения. */
  warnings: AuditWarning[];
  /** Счётчики. */
  counts: { contradictions: number; openQuestions: number };
}

/** Параметры запуска этапа 3a. */
export interface Stage3aParams {
  /** Путь к claims.json (запасной источник при пустом входе). */
  claimsPath: string;
  /** Путь к audit.json. */
  auditPath: string;
  /** Входные утверждения. */
  claims: Claim[];
  /** Дата аудита YYYY-MM-DD. */
  auditDate: string;
  /** Целевые роли из meta.targets. */
  roles: string[];
}
