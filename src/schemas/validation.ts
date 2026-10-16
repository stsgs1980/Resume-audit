import { z } from "zod";

const numberErrorSchema = z.object({
  number: z.string(),
  factId: z.string().nullable(),
  reason: z.string(),
});

const layer1Schema = z.object({
  numberErrors: z.array(numberErrorSchema),
  skillErrors: z.array(z.string()),
  forbiddenFound: z.array(z.string()),
  placeholdersFound: z.array(z.string()),
  titleOk: z.boolean(),
  requiredFieldsMissing: z.array(z.string()),
  hedgeErrors: z.array(z.string()),
  targetMetricsInResults: z.array(z.string()),
  shareSumOk: z.boolean(),
  exceptions: z.array(z.string()),
});

const verdictSchema = z.enum(["ok", "unsupported_number", "wrong_role", "missing_hedge", "is_target_metric"]);

const checkSchema = z.object({
  number: z.string(),
  claim: z.string(),
  matchesFact: z.boolean(),
  factId: z.string().nullable(),
  matchesRole: z.boolean(),
  hasHedge: z.boolean(),
  verdict: verdictSchema,
  comment: z.string(),
});

const layer2Schema = z.object({
  checks: z.array(checkSchema),
  unsupportedSkills: z.array(z.string()),
  forbiddenWordsFound: z.array(z.string()),
});

export const validationSchema = z
  .object({
    versionId: z.string(),
    roleId: z.string(),
    validatedAt: z.string(),
    factsHash: z.string(),
    promptVersion: z.string().nullable(),
    modelId: z.string().nullable(),
    layer1: layer1Schema,
    layer2: layer2Schema.nullable(),
    blocked: z.boolean(),
    blockReasons: z.array(z.string()),
  })
  .strict();

export type Validation = z.infer<typeof validationSchema>;
