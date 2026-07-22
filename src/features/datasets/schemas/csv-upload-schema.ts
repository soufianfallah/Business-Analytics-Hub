import { z } from "zod";

export const MAX_CSV_BYTES = 2 * 1024 * 1024 * 1024;

export const createCsvUploadSchema = z.object({
  organizationId: z.string().uuid(),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine(
      (name) => name.toLowerCase().endsWith(".csv"),
      "Only .csv files are supported.",
    ),
  mimeType: z.string().max(100).default("text/csv"),
  sizeBytes: z.number().int().positive().max(MAX_CSV_BYTES),
});
