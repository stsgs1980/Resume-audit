import type { ZodType } from "zod";
import {
  extractionResponseSchema,
  resumeResponseSchema,
  rolesResponseSchema,
  verificationResponseSchema,
} from "./schemas";

/** Спецификация промта: id, версия, схема ответа, system, формат. */
export interface PromptSpec<T> {
  /** Id промта (совпадает с именем файла). */
  id: string;
  /** Версия промта. */
  version: number;
  /** Zod-схема ответа LLM. */
  schema: ZodType<T>;
  /** Системная инструкция (1-2 предложения). */
  system: string;
  /** Формат вывода: всегда JSON в тексте. */
  outputFormat: "json";
}

/**
 * Запрошен несуществующий промт.
 */
export class UnknownPromptError extends Error {
  /**
   * @param id - запрошенный id
   */
  constructor(id: string) {
    super(`Unknown prompt: ${id}`);
    this.name = "UnknownPromptError";
  }
}

/** Реестр: id промта -> спецификация. */
export const promptRegistry: Record<string, PromptSpec<unknown>> = {
  extraction: {
    id: "extraction",
    version: 1,
    schema: extractionResponseSchema,
    system:
      "Ты извлекаешь утверждения из резюме. К каждому утверждению обязательна дословная цитата. " +
      "Верни только JSON.",
    outputFormat: "json",
  },
  roles: {
    id: "roles",
    version: 1,
    schema: rolesResponseSchema,
    system:
      "Ты оцениваешь соответствие кандидата целевым ролям по шкалам 0-10. " +
      "Оценки опирай только на факты из контекста. Верни только JSON.",
    outputFormat: "json",
  },
  generation_sales: {
    id: "generation_sales",
    version: 1,
    schema: resumeResponseSchema,
    system:
      "Ты готовишь резюме руководителя отдела продаж только из подтверждённых фактов. " +
      "Числа без fact_id запрещены. Верни только JSON.",
    outputFormat: "json",
  },
  generation_salesops: {
    id: "generation_salesops",
    version: 1,
    schema: resumeResponseSchema,
    system:
      "Ты готовишь резюме руководителя Sales Operations только из подтверждённых фактов. " +
      "Числа без fact_id запрещены. Верни только JSON.",
    outputFormat: "json",
  },
  generation_aipo: {
    id: "generation_aipo",
    version: 1,
    schema: resumeResponseSchema,
    system:
      "Ты готовишь резюме AI Product Owner в продажах только из подтверждённых фактов. " +
      "Числа без fact_id запрещены. Верни только JSON.",
    outputFormat: "json",
  },
  verification: {
    id: "verification",
    version: 1,
    schema: verificationResponseSchema,
    system:
      "Ты сверяешь каждое число резюме с фактами и ролью. " +
      "Неподтверждённое помечай соответствующим вердиктом. Верни только JSON.",
    outputFormat: "json",
  },
};

/**
 * Возвращает спецификацию промта по id.
 *
 * @param id - id промта
 * @returns спецификация промта
 */
export function getPromptSpec<T = unknown>(id: string): PromptSpec<T> {
  const spec = promptRegistry[id];

  if (spec === undefined) {
    throw new UnknownPromptError(id);
  }

  return spec as PromptSpec<T>;
}
