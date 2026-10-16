import type { Facts } from "../../schemas/facts";
import type { Claim } from "../stage2/types";

export type { Claim, Facts };

/** Работа из facts.json. */
export type Job = Facts["jobs"][number];

/** Результат из facts.json. */
export type JobResult = NonNullable<Job["results"]>[number];

/** Предупреждение этапа. */
export interface Stage4Warning {
  /** Код для группировки. */
  code: string;
  /** Текст. */
  message: string;
}

/** Параметры запуска этапа 4a. */
export interface Stage4aParams {
  /** Путь к claims.json. */
  claimsPath: string;
  /** Путь к facts.json. */
  factsPath: string;
  /** Путь к audit.json (для чтения open_questions в 4b). */
  auditPath: string;
  /** Путь к конфигу роли. */
  rolesConfigPath: string;
  /** Дата аудита YYYY-MM-DD. */
  auditDate: string;
  /** География, по умолчанию "Москва". */
  geography?: string;
  /** Имя кандидата, по умолчанию "". */
  candidateName?: string;
}

/** Итог этапа 4a. */
export interface Stage4aResult {
  /** Время генерации в ISO 8601. */
  generatedAt: string;
  /** Собранные факты. */
  facts: Facts;
  /** Предупреждения. */
  warnings: Stage4Warning[];
}
