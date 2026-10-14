import { z } from "zod";

const confirmedOnSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const evidenceStatusSchema = z.enum(["draft", "pending", "confirmed", "rejected"]);

export const evidenceSchema = z.object({
  fact_id: z.string(),
  source_file: z.string(),
  quote: z.string(),
  metric_definition: z.string(),
  formula: z.string().optional(),
  period: z.string(),
  baseline: z.string(),
  source_of_data: z.string(),
  zone_of_influence: z.string(),
  confirmed_by: z.string(),
  confirmed_on: confirmedOnSchema,
  status: evidenceStatusSchema,
});

export type Evidence = z.infer<typeof evidenceSchema>;
