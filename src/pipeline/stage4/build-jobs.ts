import { detectClaimCompany } from "../stage3/company";
import { extractDateRange } from "./parse-dates";
import type { Claim, Job, JobResult, Stage4Warning } from "./types";

/** Должность после "работал/должность". */
const POSITION_PATTERN = /(?:работал[а-я]*|должность)\s+([^.,;:!?()]{1,60})/iu;

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
 * Утверждения без извлекаемой компании не сливаются друг с другом:
 * job получает company "" и warning unknown_company.
 *
 * @param claims - утверждения этапа 2
 * @param roles - целевые роли (для будущих результатов)
 * @returns работы и предупреждения
 */
export function buildJobs(claims: Claim[], roles: string[]): { jobs: Job[]; warnings: Stage4Warning[] } {
  void roles;

  const groups: Array<{ company: string; claims: Claim[] }> = [];
  const byCompany = new Map<string, number>();

  for (const claim of claims) {
    if (claim.category !== "employment") {
      continue;
    }

    const company = detectClaimCompany(claim);

    if (company === null) {
      groups.push({ company: "", claims: [claim] });

      continue;
    }

    const key = company.toLowerCase();
    const existing = byCompany.get(key);

    if (existing === undefined) {
      byCompany.set(key, groups.length);
      groups.push({ company, claims: [claim] });
    } else {
      groups[existing]?.claims.push(claim);
    }
  }

  const unsorted: Job[] = [];
  const warnings: Stage4Warning[] = [];

  for (const group of groups) {
    const label = group.company === "" ? (group.claims[0]?.id ?? "") : group.company;

    if (group.company === "") {
      for (const claim of group.claims) {
        warnings.push({ code: "unknown_company", message: `Компания не извлечена из цитаты: ${claim.id}` });
      }
    }

    const ranges = new Map<string, number>();
    const starts: string[] = [];
    const usable = group.claims
      .map((claim) => extractDateRange(claim.quote))
      .filter((range) => range.confidence === "high" || range.confidence === "medium");
    const currentRanges = usable.filter((range) => range.isCurrent);
    const closedRanges = usable.filter((range) => !range.isCurrent && range.end !== null);
    const candidates = currentRanges.length > 0 ? currentRanges : closedRanges.length > 0 ? closedRanges : usable;

    for (const range of candidates) {
      if (range.start !== null) {
        starts.push(range.start);
        ranges.set(`${range.start}|${range.end ?? ""}`, (ranges.get(`${range.start}|${range.end ?? ""}`) ?? 0) + 1);
      }
    }

    if (starts.length === 0) {
      warnings.push({ code: "no_dates", message: `Недостаточно данных для дат, работа пропущена: ${label}` });

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
    const firstQuote = group.claims.map((claim) => claim.quote).find((quote) => quote.trim() !== "") ?? "";
    const isCurrent = candidates.some((range) => range.isCurrent);

    if (!isCurrent && end === null) {
      warnings.push({ code: "open_end", message: `Нет даты конца, работа пропущена: ${label}` });

      continue;
    }

    unsorted.push({
      id: "",
      company: group.company,
      position: detectPosition(firstQuote),
      start: start ?? "",
      end,
      is_current: isCurrent,
      overlap_group: null,
      parallel_justification: "",
      source_files: [...new Set(group.claims.map((claim) => claim.source_file))],
    });
  }

  unsorted.sort((left, right) => (left.start < right.start ? 1 : -1));

  unsorted.forEach((job, index) => {
    job.id = `job${index + 1}`;
  });

  return { jobs: unsorted, warnings };
}

/**
 * Определяет целевые роли результата: пересечение detected_roles
 * с целями, иначе все целевые (поле отсутствует).
 *
 * @param claim - утверждение-результат
 * @param roles - все целевые роли
 * @returns роли результата
 */
function resolveResultRoles(claim: Claim, roles: string[]): string[] {
  if (claim.detected_roles !== undefined && claim.detected_roles.length > 0) {
    const known = claim.detected_roles.filter((role) => roles.includes(role));

    if (known.length > 0) {
      return known;
    }
  }

  return [...roles];
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
    const job = jobs.find((entry) => entry.company !== "" && text.includes(entry.company.toLowerCase()));
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
      roles: resolveResultRoles(claim, roles),
      evidence_id: id,
      hedge_required: claim.requires_hedge ?? false,
      source_claim_id: claim.id,
    };
    const results = job.results ?? [];

    results.push(result);
    job.results = results;
  }

  return { jobs, warnings };
}
