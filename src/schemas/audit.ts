import { z } from "zod";

const contradictionSchema = z.object({
  id: z.string(),
  description: z.string(),
});

const openQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  status: z.string().optional(),
});

const warningSchema = z.object({
  code: z.string(),
  message: z.string(),
});

const roleAssessmentSchema = z.object({
  role_id: z.string(),
  verdict: z.string().optional(),
  score: z.number().optional(),
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
  ats: atsSchema,
});

export type Audit = z.infer<typeof auditSchema>;
