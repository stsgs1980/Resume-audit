import type { LlmClient } from "../../llm/client";
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
  /** Хеш facts.json (пусто, если facts.json ещё нет). */
  factsHash: string;
  /** Хеш мета facts.json (пусто, если facts.json ещё нет). */
  metaHash: string;
}

/** Оценка роли. */
export interface RoleAssessment {
  /** Id роли. */
  roleId: string;
  /** Оценки 0..10. */
  scores: {
    experience_fit: number;
    responsibility_level: number;
    measurable_results: number;
    keyword_fit: number;
    hr_screen: number;
    hiring_manager: number;
  };
  /** Суммарная оценка. */
  total: number;
  /** Сильные стороны. */
  strengths: string[];
  /** Пробелы. */
  gaps: string[];
  /** Риск завышения 0..10. */
  overpositioningRisk: number;
  /** Рекомендация. */
  recommendation: string;
}

/** Категория ключевого слова ATS. */
export type AtsKeywordCategory = "in_experience" | "in_skills_only" | "absent";

/** Ключевое слово ATS. */
export interface AtsKeyword {
  /** Слово. */
  keyword: string;
  /** Где найдено. */
  category: AtsKeywordCategory;
  /** Обязательное ли. */
  isMandatory: boolean;
}

/** Анализ ATS для роли. */
export interface AtsAnalysis {
  /** Id роли. */
  roleId: string;
  /** Есть ли текст вакансии. */
  hasVacancy: boolean;
  /** Ключевые слова. */
  keywords: AtsKeyword[];
  /** Обязательные отсутствующие. */
  mandatoryMissing: string[];
  /** Рекомендуемый порядок навыков. */
  recommendedSkillsOrder: string[];
}

/** Итог этапа 3b. */
export interface Stage3bResult {
  /** Время генерации в ISO 8601. */
  generatedAt: string;
  /** Оценки ролей. */
  roles: RoleAssessment[];
  /** Анализ ATS или null. */
  ats: AtsAnalysis | null;
  /** Предупреждения. */
  warnings: AuditWarning[];
  /** Ошибки без throw. */
  errors: Array<{ source: string; reason: string }>;
}

/** Параметры запуска этапа 3b. */
export interface Stage3bParams {
  /** Входные утверждения. */
  claims: Claim[];
  /** Путь к конфигу роли. */
  rolesConfigPath: string;
  /** LLM-клиент. */
  llmClient: LlmClient;
  /** Конфиг загрузчика промтов. */
  promptConfig: { promptsDir: string };
  /** Текст вакансии или null. */
  vacancyText: string | null;
  /** Целевая роль, по умолчанию "sales". */
  targetRoleId?: string;
}

/** Полный итог этапа 3 (форма audit.json). */
export interface AuditResult {
  /** Хеш фактов (пусто, пока не посчитан). */
  facts_hash: string;
  /** Хеш мета (пусто, пока не посчитан). */
  meta_hash: string;
  /** Время генерации в ISO 8601. */
  generated_at: string;
  /** Противоречия. */
  contradictions: Contradiction[];
  /** Открытые вопросы. */
  open_questions: OpenQuestion[];
  /** Предупреждения. */
  warnings: AuditWarning[];
  /** Оценки ролей. */
  roles: RoleAssessment[];
  /** Анализ ATS или null. */
  ats: AtsAnalysis | null;
}

/** Параметры запуска этапа 3. */
export interface Stage3Params extends Stage3aParams {
  /** Путь к конфигу роли. */
  rolesConfigPath: string;
  /** LLM-клиент. */
  llmClient: LlmClient;
  /** Конфиг загрузчика промтов. */
  promptConfig: { promptsDir: string };
  /** Текст вакансии или null. */
  vacancyText: string | null;
  /** Целевая роль, по умолчанию "sales". */
  targetRoleId?: string;
}

/** Параметры запуска этапа 3a. */
export interface Stage3aParams {
  /** Путь к claims.json (запасной источник при пустом входе). */
  claimsPath: string;
  /** Путь к facts.json для хешей в audit.json (опционально). */
  factsPath?: string;
  /** Путь к audit.json. */
  auditPath: string;
  /** Входные утверждения. */
  claims: Claim[];
  /** Дата аудита YYYY-MM-DD. */
  auditDate: string;
  /** Целевые роли из meta.targets. */
  roles: string[];
}
