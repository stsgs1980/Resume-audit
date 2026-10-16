import { extractDateRange } from "./parse-dates";
import type { Claim, Job, JobResult, Stage4Warning } from "./types";

/** Компания после "в" или "в компании": первое слово с заглавной. */
const COMPANY_PATTERN = /в\s+(?:компании\s+)?([А-ЯЁA-Z][^\s.,;:!?()]*)/u;

/** Должность после "работал/должность". */
const POSITION_PATTERN = /(?:работал[а-я]*|должность)\s+([^.,;:!?()]{1,60})/iu;

/**
 * Определяет компанию из формулировки или цитаты.
 *
 * @param claim - утверждение
 * @returns компания или null
 */
function detectCompany(claim: Claim): string | null {
  for (const text of [claim.statement, claim.quote]) {
    const match = COMPANY_PATTERN.exec(text);

    if (match?.[1] !== undefined) {
      return match[1];
    }
  }

  return null;
}

/**
 * Извлекает должность из цитаты.
 *
 * @param quote - цитата утверждения
 * @returns должность или ""
 */
function detectPosition(quote: string): string {
  const match = POSITION_PATTERN.exec(quote);

  return (match?.[1] ?? "").trim();
}

/**
 * Строит jobs группировкой employment-утверждений по компаниям.
 * Без дат работа пропускается с предупреждением (даты не выдумываются).
 *
 * @param claims - утверждения этапа 2
 * @param roles - целевые роли (для будущих результатов)
 * @returns работы и предупреждения
 */
export function buildJobs(claims: Claim[], roles: string[]): { jobs: Job[]; warnings: Stage4Warning[] } {
  void roles;

  const groups = new Map<string, Claim[]>();

  for (const claim of claims) {
    if (claim.category !== "employment") {
      continue;
    }

    const company = detectCompany(claim) ?? "unknown";
    const group = groups.get(company) ?? [];

    group.push(claim);
    groups.set(company, group);
  }

  const unsorted: Job[] = [];
  const warnings: Stage4Warning[] = [];

  for (const [company, group] of groups) {
    if (company === "unknown") {
      warnings.push({ code: "unknown_company", message: `Компания не определена: ${group[0]?.id}` });
    }

    const ranges = new Map<string, number>();
    const starts: string[] = [];

    for (const claim of group) {
      const range = extractDateRange(claim.quote);

      if (range.start !== null) {
        starts.push(range.start);
        ranges.set(`${range.start}|${range.end ?? ""}`, (ranges.get(`${range.start}|${range.end ?? ""}`) ?? 0) + 1);
      }
    }

    if (starts.length === 0) {
      warnings.push({ code: "no_dates", message: `Даты не найдены, работа пропущена: ${company}` });

      continue;
    }

    let best = "";
    let bestCount = 0;

    for (const [key, count] of ranges) {
      if (count > bestCount) {
        best = key;
        bestCount = count;
      }
    }

    const [start, endRaw] = best.split("|");
    const end = endRaw === "" || endRaw === undefined ? null : endRaw;
    const firstQuote = group.map((claim) => claim.quote).find((quote) => quote.trim() !== "") ?? "";
    const isCurrent = group.some((claim) => extractDateRange(claim.quote).isCurrent);

    if (!isCurrent && end === null) {
      warnings.push({ code: "open_end", message: `Нет даты конца, работа пропущена: ${company}` });

      continue;
    }

    unsorted.push({
      id: "",
      company,
      position: detectPosition(firstQuote),
      start: start ?? "",
      end,
      is_current: isCurrent,
      overlap_group: null,
      parallel_justification: "",
      source_files: [...new Set(group.map((claim) => claim.source_file))],
    });
  }

  unsorted.sort((left, right) => (left.start < right.start ? 1 : -1));

  unsorted.forEach((job, index) => {
    job.id = `job${index + 1}`;
  });

  return { jobs: unsorted, warnings };
}

/**
 * Привязывает result-утверждения к работам по совпадению компании.
 *
 * @param claims - утверждения этапа 2
 * @param jobs - построенные работы
 * @param roles - целевые роли для фактов
 * @returns работы с результатами и предупреждения
 */
export function buildResults(
  claims: Claim[],
  jobs: Job[],
  roles: string[],
): { jobs: Job[]; warnings: Stage4Warning[] } {
  const warnings: Stage4Warning[] = [];
  let counter = 1;

  for (const claim of claims) {
    if (claim.category !== "result") {
      continue;
    }

    const text = `${claim.statement} ${claim.quote}`.toLowerCase();
    const job = jobs.find((entry) => text.includes(entry.company.toLowerCase()));
    const id = `res${counter}`;

    counter += 1;

    if (job === undefined) {
      warnings.push({ code: "unbound_result", message: `Результат не привязан: ${claim.id}` });

      continue;
    }

    const result: JobResult = {
      id,
      key: "",
      text: claim.statement,
      number: claim.number,
      unit: "",
      currency: claim.currency,
      status: claim.status,
      roles: [...roles],
      evidence_id: id,
      hedge_required: false,
      source_claim_id: claim.id,
    };
    const results = job.results ?? [];

    results.push(result);
    job.results = results;
  }

  return { jobs, warnings };
}
