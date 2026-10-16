import type { LlmClient } from "../../llm/client";
import type { ExtractionResponse, RolesResponse } from "../../llm/schemas";
import type { LlmCallResult } from "../../llm/types";

/** Текст резюме для сквозного прогона этапов 1-4. */
export const resumeText = [
  "Иван Иванов, руководитель отдела продаж.",
  "Работал в компании Ромашка с 2020-01 по 2021-01.",
  "По учёту выручка выросла на 4,2 млн руб.",
].join("\n");

/** Утверждения, которые mock-клиент возвращает на этапе 2. */
export const rawClaims: ExtractionResponse["claims"] = [
  {
    statement: "работал в компании Ромашка руководителем",
    quote: "работал в компании Ромашка с 2020-01 по 2021-01",
    source_file: "resume.md",
    category: "employment",
    metric_type: "",
    number: null,
    currency: null,
    status: "confirmed",
    reason: "",
  },
  {
    statement: "Выручка компании Ромашка выросла на 4,2 млн",
    quote: "по учёту выручка выросла на 4,2 млн руб",
    source_file: "resume.md",
    category: "result",
    metric_type: "выручка",
    number: 4200000,
    currency: "RUB",
    status: "needs_evidence",
    reason: "",
  },
];

/** Оценки ролей, которые mock-клиент возвращает на этапе 3b. */
export const rolesPayload: RolesResponse = {
  roles: [
    {
      role_id: "sales",
      scores: {
        experience_fit: 8,
        responsibility_level: 8,
        measurable_results: 7,
        keyword_fit: 7,
        hr_screen: 8,
        hiring_manager: 7,
      },
      total: 45,
      strengths: ["опыт"],
      gaps: [],
      overpositioning_risk: 2,
      recommendation: "подходит",
    },
  ],
};

/**
 * Mock-клиент: extraction и roles по stage.
 *
 * @returns клиент
 */
export const mockClient = (): LlmClient => ({
  health: () => Promise.resolve(true),
  call: <T>(callParams: { stage?: string }): Promise<LlmCallResult<T>> => {
    if (callParams.stage === "roles") {
      return Promise.resolve({ ok: true, data: rolesPayload as unknown as T });
    }

    return Promise.resolve({ ok: true, data: { claims: rawClaims } as unknown as T });
  },
});

/** Значения полей карточки evidence по порядку. */
export const evidenceValues = [
  "resume.md",
  "выручка выросла",
  "выручка направления",
  "учёт 2023 минус учёт 2022",
  "2023-01 - 2023-12",
  "база 2022 года",
  "управленческий учёт",
  "направление, 4 менеджера",
];

/**
 * Ввод 4b: поля карточки по очереди, остальное свободной строкой.
 *
 * @param queue - значения полей карточки
 * @returns функция ввода
 */
export const inputFor = (queue: string[]): ((prompt: string) => Promise<string>) => {
  return (prompt: string) => {
    if (prompt.startsWith("Ответ (или")) {
      return Promise.resolve("подтверждаю");
    }

    return Promise.resolve(queue.shift() ?? "значение");
  };
};
