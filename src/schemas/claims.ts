import { z } from "zod";

/** Валюта числа или null, если валюта не определена. */
const currencySchema = z.enum(["RUB", "USD", "EUR"]).nullable();

/** Статус утверждения. */
const claimStatusSchema = z.enum(["confirmed", "needs_evidence", "remove"]);

/** Категория утверждения. */
const categorySchema = z.enum(["employment", "result", "skill", "tool", "education", "language", "project", "link"]);

/** Одно утверждение с цитатой: источник правды для claims.json. */
export const claimSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  quote: z.string().min(1),
  source_file: z.string().min(1),
  category: categorySchema,
  metric_type: z.string(),
  number: z.number().nullable(),
  currency: currencySchema,
  status: claimStatusSchema,
  reason: z.string(),
  detected_roles: z.array(z.string()).optional(),
  requires_hedge: z.boolean().optional(),
});

export const claimsSchema = z.object({
  claims: z.array(claimSchema),
});

export type Claim = z.infer<typeof claimSchema>;
export type Claims = z.infer<typeof claimsSchema>;
