import { z } from "zod";

const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM");
const auditDateSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "YYYY-MM-DD");
const currencySchema = z.enum(["RUB", "USD", "EUR"]).nullable();
const factStatusSchema = z.enum(["confirmed", "needs_evidence", "remove"]);
const shareSchema = z.number().min(0).max(1);

const targetSchema = z.object({
  id: z.string(),
  title: z.string(),
  share_of_applications: shareSchema,
});

const metaSchema = z.object({
  candidate_name: z.string(),
  audit_date: auditDateSchema,
  geography: z.string(),
  targets: z.array(targetSchema),
});

const resultSchema = z.object({
  id: z.string(),
  key: z.string(),
  text: z.string(),
  number: z.number().nullable(),
  unit: z.string(),
  currency: currencySchema,
  status: factStatusSchema,
  roles: z.array(z.string()),
  evidence_id: z.string(),
  hedge_required: z.boolean(),
});

const jobSchema = z
  .object({
    id: z.string(),
    company: z.string(),
    industry: z.string().optional(),
    position: z.string(),
    start: yearMonthSchema,
    end: yearMonthSchema.nullable().optional(),
    is_current: z.boolean(),
    overlap_group: z.string().nullable().optional(),
    parallel_justification: z.string().optional(),
    team_size: z.string().optional(),
    context: z.string().optional(),
    actions: z.array(z.string()).optional(),
    results: z.array(resultSchema).optional(),
    source_files: z.array(z.string()).optional(),
  })
  .superRefine((job, context) => {
    const end = job.end ?? null;

    if (job.is_current && end !== null) {
      context.addIssue({ code: "custom", message: "is_current job must not have end" });
    }

    if (!job.is_current && end === null) {
      context.addIssue({ code: "custom", message: "finished job must have end" });
    }

    if (end !== null && job.start > end) {
      context.addIssue({ code: "custom", message: "job start must not be after end" });
    }
  });

const educationSchema = z.object({
  id: z.string(),
  institution: z.string(),
  program: z.string().optional(),
  start: yearMonthSchema.optional(),
  end: yearMonthSchema.optional(),
});

const languageSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.string().optional(),
});

const confirmedSkillSchema = z.object({
  id: z.string(),
  skill: z.string(),
  roles: z.array(z.string()),
});

const portfolioProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  roles: z.array(z.string()).optional(),
});

export const factsSchema = z.object({
  schema_version: z.literal(1),
  meta: metaSchema,
  jobs: z.array(jobSchema),
  education: z.array(educationSchema),
  languages: z.array(languageSchema),
  confirmed_skills: z.array(confirmedSkillSchema),
  portfolio_projects: z.array(portfolioProjectSchema),
});

export type Facts = z.infer<typeof factsSchema>;
