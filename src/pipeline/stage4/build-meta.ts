import type { Facts } from "./types";

/** Мета из facts.json. */
type Meta = Facts["meta"];

/** Цель роли из конфига. */
interface RoleTarget {
  /** Id роли. */
  id: string;
  /** Название. */
  title: string;
  /** Доля откликов. */
  share: number;
}

/** Параметры сборки meta. */
export interface BuildMetaParams {
  /** Имя кандидата. */
  candidateName: string;
  /** Дата аудита. */
  auditDate: string;
  /** География. */
  geography: string;
  /** Цели из конфига роли. */
  targets: RoleTarget[];
}

/**
 * Собирает meta: имена, дата, география, доли из конфига роли.
 *
 * @param params - параметры сборки
 * @returns meta для facts.json
 */
export function buildMeta(params: BuildMetaParams): Meta {
  return {
    candidate_name: params.candidateName,
    audit_date: params.auditDate,
    geography: params.geography,
    targets: params.targets.map((target) => ({
      id: target.id,
      title: target.title,
      share_of_applications: target.share,
    })),
  };
}
