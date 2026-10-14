import { z } from "zod";

const numberErrorSchema = z.object({
  number: z.string(),
  found: z.boolean(),
  factId: z.string().nullable(),
  reason: z.string(),
});

const layer1Schema = z.object({
  ok: z.boolean(),
  numberErrors: z.array(numberErrorSchema).optional(),
  skillErrors: z.array(z.string()).optional(),
  forbiddenFound: z.array(z.string()).optional(),
  hedgeErrors: z.array(z.string()).optional(),
  missingFields: z.array(z.string()).optional(),
  shareSumOk: z.boolean().optional(),
  exceptions: z.array(z.string()).optional(),
});

const verdictSchema = z.enum(["ok", "unsupported_number", "wrong_role", "missing_hedge", "is_target_metric"]);

const checkSchema = z.object({
  number: z.string(),
  claim: z.string(),
  matches_fact: z.boolean(),
  fact_id: z.string(),
  matches_role: z.boolean(),
  has_hedge: z.boolean(),
  verdict: verdictSchema,
  comment: z.string(),
});

const layer2Schema = z.object({
  checks: z.array(checkSchema),
  unsupported_skills: z.array(z.string()),
  forbidden_words_found: z.array(z.string()),
});

export const validationSchema = z
  .object({
    layer1: layer1Schema,
    layer2: layer2Schema,
  })
  .strict();

export type Validation = z.infer<typeof validationSchema>;
