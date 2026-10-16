import type { ValidationLayer1, ValidationLayer2 } from "./types";

/**
 * Собирает причины блокировки экспорта версии.
 *
 * @param layer1 - итог слоя 1
 * @param layer2 - итог слоя 2 или null
 * @returns причины блокировки, пусто если экспорт разрешён
 */
export function computeBlockReason(layer1: ValidationLayer1, layer2: ValidationLayer2 | null): string[] {
  const reasons: string[] = [];

  if (layer1.numberErrors.length > 0) {
    reasons.push("числа не найдены в facts.json");
  }

  if (layer1.skillErrors.length > 0) {
    reasons.push("неподтверждённые навыки");
  }

  if (layer1.hedgeErrors.length > 0) {
    reasons.push("отсутствует оговорка");
  }

  if (layer1.titleOk === false) {
    reasons.push("заголовок не соответствует роли");
  }

  if (layer1.requiredFieldsMissing.length > 0) {
    reasons.push("не все обязательные поля hh.ru");
  }

  if (layer1.shareSumOk === false) {
    reasons.push("сумма долей вне [0.99, 1.01]");
  }

  if (layer2 !== null && layer2.checks.some((check) => check.verdict !== "ok")) {
    reasons.push("расхождения слоя 2");
  }

  return reasons;
}

/**
 * Проверяет, заблокирован ли экспорт.
 *
 * @param reasons - причины из computeBlockReason
 * @returns true при хотя бы одной причине
 */
export function isBlocked(reasons: string[]): boolean {
  return reasons.length > 0;
}
