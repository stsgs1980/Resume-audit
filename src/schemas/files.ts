import { z } from "zod";

/** Вид исходного файла. */
const fileKindSchema = z.enum([
  "hh_export",
  "resume_draft",
  "vacancy",
  "flagged_synthetic",
  "ai_inflated",
  "technical_audit",
  "unknown",
]);

/** Статус чтения файла. */
const fileStatusSchema = z.enum(["ok", "unreadable", "unsupported"]);

/** Запись инвентаря об одном файле (этап 1). */
export const fileEntrySchema = z.object({
  path: z.string(),
  name: z.string(),
  kind: fileKindSchema,
  status: fileStatusSchema,
  encoding: z.string().nullable(),
  warnings: z.array(z.string()),
  size: z.number(),
});

/** files.json: инвентарь файлов этапа 1. */
export const filesSchema = z.object({
  rootDir: z.string(),
  files: z.array(fileEntrySchema),
});

export type FileKind = z.infer<typeof fileKindSchema>;
export type FileStatus = z.infer<typeof fileStatusSchema>;
export type FileEntry = z.infer<typeof fileEntrySchema>;
export type Files = z.infer<typeof filesSchema>;
