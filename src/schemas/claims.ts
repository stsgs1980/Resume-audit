import { z } from "zod";

const currencySchema = z.enum(["RUB", "USD", "EUR"]).nullable();
const claimStatusSchema = z.enum(["confirmed", "needs_evidence", "remove"]);
const categorySchema = z.enum(["employment", "result", "skill", "tool", "education", "language", "project", "link"]);

const claimSchema = z.object({
  id: z.string(),
  statement: z.string(),
  quote: z.string(),
  source_file: z.string(),
  category: categorySchema,
  metric_type: z.string().nullable().optional(),
  number: z.number().nullable().optional(),
  currency: currencySchema.optional(),
  status: claimStatusSchema,
  reason: z.string().optional(),
  detected_roles: z.array(z.string()).optional(),
  requires_hedge: z.boolean().optional(),
});

export const claimsSchema = z.object({
  claims: z.array(claimSchema),
});

export type Claims = z.infer<typeof claimsSchema>;
