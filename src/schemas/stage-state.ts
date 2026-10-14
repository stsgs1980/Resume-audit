import { z } from "zod";

const stageStatusSchema = z.enum(["pending", "running", "completed", "failed", "incomplete", "stale", "blocked"]);

const stageEntrySchema = z.object({
  status: stageStatusSchema,
  updated_at: z.string(),
});

const documentEntrySchema = z.object({
  facts_hash: z.string().optional(),
  prompt_version: z.string().optional(),
  model_id: z.string().optional(),
  generated_at: z.string().optional(),
  stale: z.boolean(),
});

export const stageStateSchema = z.object({
  run_id: z.string(),
  stages: z.record(z.string(), stageEntrySchema),
  documents: z.record(z.string(), documentEntrySchema),
});

export type StageState = z.infer<typeof stageStateSchema>;
