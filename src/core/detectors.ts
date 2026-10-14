/**
 * Детекторы контента: плейсхолдеры, запрещённые слова, прогнозные маркеры,
 * недоказанная причинность.
 *
 * Модуль ролей не знает. Все списки принимает аргументами
 * (см. config/*.json).
 */

/**
 * Строчные + ё->е для матчинга маркеров.
 *
 * @param value - исходная строка
 * @returns строка в нижнем регистре с е вместо ё
 */
function foldCase(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е");
}

/**
 * Ищет кандидатов как подстроки без учёта регистра.
 *
 * @param text - проверяемый текст
 * @param candidates - искомые подстроки
 * @returns кандидаты, найденные в тексте
 */
function findSubstrings(text: string, candidates: string[]): string[] {
  const lower = text.toLowerCase();

  return candidates.filter((candidate) => candidate.length > 0 && lower.includes(candidate.toLowerCase()));
}

/**
 * Находит плейсхолдеры: возвращает совпавшие шаблоны.
 *
 * Шаблоны — источники regex, матчинг регистронезависимый.
 * Невалидный шаблон бросает SyntaxError.
 *
 * @param text - проверяемый текст
 * @param patterns - источники regex из config/placeholders.json
 * @returns подмножество patterns, совпавших с текстом
 */
export function detectPlaceholders(text: string, patterns: string[]): string[] {
  return patterns.filter((pattern) => new RegExp(pattern, "i").test(text));
}

/**
 * Находит запрещённые слова: ищет как подстроку, регистронезависимо.
 *
 * Это маркеры, а не токены: "production" находится в "production-ready"
 * и в "довёл до production". Границы слов не требуются.
 *
 * @param text - проверяемый текст
 * @param words - слова из config/forbidden-words.json
 * @returns найденные слова
 */
export function detectForbiddenWords(text: string, words: string[]): string[] {
  return findSubstrings(text, words);
}

/**
 * Находит прогнозные маркеры как подстроки без учёта регистра.
 *
 * @param text - проверяемый текст
 * @param markers - маркеры из config/forecast-markers.json
 * @returns найденные маркеры
 */
export function detectForecastMarkers(text: string, markers: string[]): string[] {
  return findSubstrings(text, markers);
}

/**
 * Проверяет недоказанную причинность (SPEC-pipeline.md, раздел 3.9).
 *
 * Маркер источника всегда даёт false. Иначе true, если есть явный
 * causalMarker либо числовой эффект, приписанный другой стороне
 * (см. actorPrefixes в config/causality.json).
 *
 * @param text - проверяемый текст
 * @param sourceMarkers - маркеры источника из config/causality.json
 * @param causalMarkers - маркеры причинности из config/causality.json
 * @param actorPrefixes - префиксы сторон из config/causality.json
 * @returns true — причинность без источника, требует проверки
 */
export function detectCausalityWithoutSource(
  text: string,
  sourceMarkers: string[],
  causalMarkers: string[],
  actorPrefixes: string[],
): boolean {
  const folded = foldCase(text);
  const hasSource = sourceMarkers.some((marker) => marker.length > 0 && folded.includes(foldCase(marker)));

  if (hasSource) {
    return false;
  }

  const hasCausal = causalMarkers.some((marker) => marker.length > 0 && folded.includes(foldCase(marker)));

  if (hasCausal) {
    return true;
  }

  return /\d/.test(folded) && actorPrefixes.some((actor) => actor.length > 0 && folded.includes(foldCase(actor)));
}
