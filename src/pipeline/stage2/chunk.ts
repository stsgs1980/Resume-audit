/**
 * Проверяет, нужен ли чанкинг.
 *
 * @param text - текст файла
 * @param threshold - порог в символах
 * @returns true, если текст длиннее порога
 */
export function needsChunking(text: string, threshold: number): boolean {
  return text.length > threshold;
}

/**
 * Режет текст длиннее maxChars по абзацам в кусок не длиннее maxChars.
 *
 * @param text - остаток текста
 * @param maxChars - лимит куска
 * @returns кусок не длиннее maxChars
 */
function cutPiece(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  const paragraphs = text.split("\n\n");
  let piece = "";

  for (const paragraph of paragraphs) {
    const candidate = piece === "" ? paragraph : `${piece}\n\n${paragraph}`;

    if (candidate.length > maxChars) {
      break;
    }

    piece = candidate;
  }

  if (piece !== "") {
    return piece;
  }

  return text.slice(0, maxChars);
}

/**
 * Разбивает текст на чанки по абзацам с перекрытием 10%.
 * Перекрытие — последние N символов предыдущего чанка в начале следующего.
 *
 * @param text - текст файла
 * @param maxChars - максимальный размер чанка
 * @returns чанки
 */
export function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars || maxChars < 1) {
    return [text];
  }

  const overlap = Math.floor(maxChars * 0.1);
  const chunks: string[] = [];
  let rest = text;

  while (rest.length > 0) {
    const piece = cutPiece(rest, maxChars);

    chunks.push(piece);
    rest = rest.slice(piece.length).replace(/^\n+/, "");

    if (rest.length > 0 && overlap > 0) {
      const tail = chunks[chunks.length - 1] ?? "";

      rest = `${tail.slice(-overlap)}\n\n${rest}`;
    }
  }

  return chunks;
}
