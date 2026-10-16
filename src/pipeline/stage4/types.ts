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
  /** facts.json записан (false при schema_mismatch). */
  written: boolean;
  /** Предупреждения. */
  warnings: Stage4Warning[];
}

/** Данные карточки evidence (ввод кандидата). */
export interface EvidenceData {
  /** Файл-источник. */
  sourceFile: string;
  /** Дословная цитата. */
  quote: string;
  /** Определение метрики. */
  metricDefinition: string;
  /** Формула расчёта. */
  formula: string;
  /** Период. */
  period: string;
  /** Базовое значение. */
  baseline: string;
  /** Источник данных. */
  sourceOfData: string;
  /** Зона влияния. */
  zoneOfInfluence: string;
}

/** Ответ кандидата на вопрос. */
export interface Answer {
  /** Id вопроса. */
  questionId: string;
  /** Время ответа в ISO 8601. */
  answeredAt: string;
  /** Кто ответил. */
  answeredBy: string;
  /** Статус ответа. */
  status: "answered" | "deferred" | "rejected";
  /** Карточка evidence (для missing_evidence). */
  evidence?: EvidenceData;
  /** Свободный текст (для остальных типов). */
  freeText?: string;
}

/** Итог этапа 4b. */
export interface Stage4bResult {
  /** Отвеченных вопросов. */
  answersProcessed: number;
  /** Отложенных. */
  answersDeferred: number;
  /** Отклонённых. */
  answersRejected: number;
  /** fact_id записанных карточек. */
  evidenceWritten: string[];
  /** Удалось ли залочить. */
  locked: boolean;
  /** Причины незалочивания. */
  lockReasons: string[];
  /** Предупреждения. */
  warnings: Array<{ code: string; message: string }>;
}

/** Параметры запуска этапа 4b. */
export interface Stage4bParams {
  /** Директория workspace. */
  workspaceDir: string;
  /** Путь к audit.json. */
  auditPath: string;
  /** Путь к facts.json. */
  factsPath: string;
  /** Директория карточек evidence. */
  evidenceDir: string;
  /** Путь к lock-файлу. */
  lockPath: string;
  /** Директория ответов. */
  answersPath: string;
  /** Ввод (по умолчанию readline). */
  inputFn?: (prompt: string) => Promise<string>;
  /** Вывод (по умолчанию console.log). */
  outputFn?: (line: string) => void;
}
