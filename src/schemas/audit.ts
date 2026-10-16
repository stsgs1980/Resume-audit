import { z } from "zod";

const contradictionSchema = z.object({
  id: z.string(),
  kind: z.enum(["number_mismatch", "date_mismatch", "duration_mismatch", "skill_conflict"]),
  severity: z.enum(["warning", "hard"]),
  factIds: z.array(z.string()),
  description: z.string(),
  evidence: z.array(z.string()),
});

const openQuestionSchema = z.object({
  id: z.string(),
  type: z.enum([
    "missing_evidence",
    "contradiction",
    "ambiguous_date",
    "parallel_roles",
    "gap",
    "currency_missing",
    "target_vs_measured",
    "skill_usage",
    "other",
  ]),
  question: z.string(),
  context: z.string(),
  relatedClaimIds: z.array(z.string()),
  createdFrom: z.string(),
  status: z.string().optional(),
});

const warningSchema = z.object({
  id: z.string(),
  kind: z.string(),
  code: z.string(),
  message: z.string(),
});

const roleScoresSchema = z.object({
  experience_fit: z.number(),
  responsibility_level: z.number(),
  measurable_results: z.number(),
  keyword_fit: z.number(),
  hr_screen: z.number(),
  hiring_manager: z.number(),
});

const roleAssessmentSchema = z.object({
  roleId: z.string(),
  scores: roleScoresSchema,
  total: z.number(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  overpositioningRisk: z.number(),
  recommendation: z.string(),
});

const atsSchema = z.record(z.string(), z.unknown());

export const auditSchema = z.object({
  facts_hash: z.string(),
  meta_hash: z.string(),
  generated_at: z.string().datetime(),
  contradictions: z.array(contradictionSchema),
  open_questions: z.array(openQuestionSchema),
  warnings: z.array(warningSchema),
  roles: z.array(roleAssessmentSchema),
  ats: atsSchema.nullable(),
});

export type Audit = z.infer<typeof auditSchema>;
