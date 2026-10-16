import type { LlmClient } from "../../llm/client";

/** Ошибка по одному числу слоя 1. */
export interface Layer1NumberError {
  /** Токен числа из текста резюме. */
  number: string;
  /** Id факта или null. */
  factId: string | null;
  /** Причина на русском с кодом. */
  reason: string;
}

/** Слой 1: детерминированная проверка кодом. */
export interface ValidationLayer1 {
  /** Числа без факта или чужой роли. */
  numberErrors: Layer1NumberError[];
  /** Навыки без подтверждения для роли. */
  skillErrors: string[];
  /** Найденные запрещённые слова. */
  forbiddenFound: string[];
  /** Совпавшие плейсхолдеры. */
  placeholdersFound: string[];
  /** Заголовок без слэша и по роли. */
  titleOk: boolean;
  /** Отсутствующие обязательные поля hh.ru. */
  requiredFieldsMissing: string[];
  /** fact_id без обязательной оговорки. */
  hedgeErrors: string[];
  /** Числа target_metrics в блоке результатов. */
  targetMetricsInResults: string[];
  /** Сумма долей в [0.99, 1.01]. */
  shareSumOk: boolean;
  /** Исключения: телефоны, годы, версии. */
  exceptions: string[];
}

/** Одна проверка слоя 2. */
export interface Layer2Check {
  /** Число из текста. */
  number: string;
  /** Формулировка утверждения. */
  claim: string;
  /** Совпадает с фактом. */
  matchesFact: boolean;
  /** Id факта или null. */
  factId: string | null;
  /** Число принадлежит роли. */
  matchesRole: boolean;
  /** Оговорка присутствует. */
  hasHedge: boolean;
  /** Вердикт проверки. */
  verdict: "ok" | "unsupported_number" | "wrong_role" | "missing_hedge" | "is_target_metric";
  /** Комментарий модели. */
  comment: string;
}

/** Слой 2: проверка LLM. */
export interface ValidationLayer2 {
  /** Проверки по числам. */
  checks: Layer2Check[];
  /** Неподтверждённые навыки по мнению модели. */
  unsupportedSkills: string[];
  /** Найденные запрещённые слова. */
  forbiddenWordsFound: string[];
}

/** Итог верификации одной версии. */
export interface ValidationResult {
  /** Id версии вида "hh_v1_sales". */
  versionId: string;
  /** Целевая роль. */
  roleId: string;
  /** Время проверки в ISO 8601. */
  validatedAt: string;
  /** Хеш фактов на момент проверки. */
  factsHash: string;
  /** Версия промта слоя 2 или null. */
  promptVersion: string | null;
  /** Id модели слоя 2 или null. */
  modelId: string | null;
  /** Слой 1. */
  layer1: ValidationLayer1;
  /** Слой 2 или null. */
  layer2: ValidationLayer2 | null;
  /** Экспорт версии заблокирован. */
  blocked: boolean;
  /** Причины блокировки. */
  blockReasons: string[];
}

/** Итог этапа 8. */
export interface Stage8Result {
  /** Проверенные версии. */
  validated: ValidationResult[];
  /** Пропущенные версии с причинами. */
  skipped: Array<{ versionId: string; reason: string }>;
  /** Ошибки по версиям. */
  errors: Array<{ versionId: string; reason: string }>;
  /** Предупреждения этапа. */
  warnings: Array<{ code: string; message: string }>;
  /** True, если хотя бы одна версия blocked. */
  exportBlocked: boolean;
}

/** Параметры запуска этапа 8. */
export interface Stage8Params {
  /** Путь к facts.json. */
  factsPath: string;
  /** Путь к facts.lock. */
  lockPath: string;
  /** Директория версий резюме. */
  resumesDir: string;
  /** Директория validation/*.json. */
  validationDir: string;
  /** Директория карточек evidence. */
  evidenceDir: string;
  /** Путь к конфигу роли. */
  rolesConfigPath: string;
  /** LLM-клиент для слоя 2. */
  llmClient: LlmClient;
  /** Конфиг загрузчика промтов. */
  promptConfig: { promptsDir: string };
  /** Id модели слоя 2. */
  modelId: string;
  /** Включить слой 2, по умолчанию true. */
  enableLayer2?: boolean;
}
