/**
 * Анализ интервалов: разрывы и пересечения работ.
 *
 * См. docs/superpowers/specs/SPEC-dates.md разделы 2, 6, 7.
 */

import { toMonths } from "./dates";
import type { Gap, Overlap, ResolvedInterval } from "./experience";

/**
 * Находит разрывы больше указанного порога между последовательными работами.
 *
 * Работы сортируются по началу. Стык (prev.end == next.start) не разрыв.
 * Разрыв ровно threshold месяцев не флагуется, строго больше — флагуется.
 *
 * @param intervals - разрешённые интервалы
 * @param threshold - порог в месяцах (по умолчанию 3)
 * @returns список разрывов
 */
export function findGaps(intervals: ResolvedInterval[], threshold = 3): Gap[] {
  if (intervals.length < 2) {
    return [];
  }

  const sorted = [...intervals].sort((a, b) => toMonths(a.start) - toMonths(b.start));

  const gaps: Gap[] = [];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const next = sorted[i];

    if (!prev || !next) {
      continue;
    }

    const prevEnd = toMonths(prev.end);
    const nextStart = toMonths(next.start);
    const gapMonths = nextStart - prevEnd - 1;

    if (gapMonths > threshold) {
      gaps.push({
        fromJobId: prev.id,
        toJobId: next.id,
        months: gapMonths,
        fromEnd: prev.end,
        toStart: next.start,
      });
    }
  }

  return gaps;
}

/**
 * Находит пересечения между работами из разных overlap_group.
 *
 * Смежность (prev.end == next.start) не пересечение.
 *
 * @param intervals - разрешённые интервалы
 * @returns список пересечений
 */
export function findOverlaps(intervals: ResolvedInterval[]): Overlap[] {
  const overlaps: Overlap[] = [];

  for (let i = 0; i < intervals.length; i += 1) {
    for (let j = i + 1; j < intervals.length; j += 1) {
      const a = intervals[i];
      const b = intervals[j];

      if (!a || !b) {
        continue;
      }

      if (a.overlapGroup !== null && a.overlapGroup === b.overlapGroup) {
        continue;
      }

      const aStart = toMonths(a.start);
      const aEnd = toMonths(a.end);
      const bStart = toMonths(b.start);
      const bEnd = toMonths(b.end);

      // Смежность: конец одного совпадает с началом другого.
      // Это не пересечение, а нормальная последовательность.
      if (aEnd === bStart || bEnd === aStart) {
        continue;
      }

      const overlapStart = Math.max(aStart, bStart);
      const overlapEnd = Math.min(aEnd, bEnd);

      if (overlapStart <= overlapEnd) {
        overlaps.push({
          jobIdA: a.id,
          jobIdB: b.id,
          months: overlapEnd - overlapStart + 1,
        });
      }
    }
  }

  return overlaps;
}
