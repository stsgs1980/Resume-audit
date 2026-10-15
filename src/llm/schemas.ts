import { z } from "zod";

const llmCurrencySchema = z.enum(["RUB", "USD", "EUR"]).nullable();
const claimStatusSchema = z.enum(["confirmed", "needs_evidence", "remove"]);
const claimCategorySchema = z.enum([
  "employment",
  "result",
  "skill",
  "tool",
  "education",
  "language",
  "project",
  "link",
]);
const scoreSchema = z.number().int().min(0).max(10);
const verdictSchema = z.enum(["ok", "unsupported_number", "wrong_role", "missing_hedge", "is_target_metric"]);

export const extractionResponseSchema = z.object({
  claims: z.array(
    z.object({
      statement: z.string(),
      quote: z.string().min(1),
      source_file: z.string(),
      category: claimCategorySchema,
      metric_type: z.string(),
      number: z.number().nullable(),
      currency: llmCurrencySchema,
      status: claimStatusSchema,
      reason: z.string(),
    }),
  ),
});

export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;

const roleScoresSchema = z.object({
  experience_fit: scoreSchema,
  responsibility_level: scoreSchema,
  measurable_results: scoreSchema,
  keyword_fit: scoreSchema,
  hr_screen: scoreSchema,
  hiring_manager: scoreSchema,
});

export const rolesResponseSchema = z.object({
  roles: z.array(
    z.object({
      role_id: z.string(),
      scores: roleScoresSchema,
      total: z.number(),
      strengths: z.array(z.string()),
      gaps: z.array(z.string()),
      overpositioning_risk: scoreSchema,
      recommendation: z.string(),
    }),
  ),
});

export type RolesResponse = z.infer<typeof rolesResponseSchema>;

const resumeResultSchema = z.object({
  text: z.string(),
  fact_id: z.string().min(1),
  hedge_present: z.boolean(),
});

const resumeJobSchema = z.object({
  job_id: z.string(),
  company: z.string(),
  industry: z.string(),
  position: z.string(),
  period: z.string(),
  duration: z.string(),
  context: z.string(),
  actions: z.array(z.string()),
  results: z.array(resumeResultSchema),
  total_experience_inconsistent: z.boolean(),
  total_experience_note: z.string(),
});

export const resumeResponseSchema = z.object({
  title: z.string(),
  specialization: z.string(),
  employment_type: z.string(),
  work_format: z.string(),
  experience_total: z.string(),
  experience_as_of: z.string(),
  about: z.string(),
  jobs: z.array(resumeJobSchema),
  skills: z.array(
    z.object({
      skill: z.string(),
      skill_id: z.string(),
    }),
  ),
  languages: z.array(z.string()),
});

export type ResumeResponse = z.infer<typeof resumeResponseSchema>;

export const verificationResponseSchema = z.object({
  checks: z.array(
    z.object({
      number: z.string(),
      claim: z.string(),
      matches_fact: z.boolean(),
      fact_id: z.string().nullable(),
      matches_role: z.boolean(),
      has_hedge: z.boolean(),
      verdict: verdictSchema,
      comment: z.string(),
    }),
  ),
  unsupported_skills: z.array(z.string()),
  forbidden_words_found: z.array(z.string()),
});

export type VerificationResponse = z.infer<typeof verificationResponseSchema>;
