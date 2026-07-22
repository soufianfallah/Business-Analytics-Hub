import { ReportFormat } from "@prisma/client";
import { z } from "zod";

export const reportInputSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  datasetId: z.string().uuid(),
  format: z.nativeEnum(ReportFormat).default(ReportFormat.PDF),
  columns: z.array(z.string().min(1).max(255)).max(100).default([]),
  saveAsTemplate: z.boolean().default(false),
  schedule: z
    .object({
      frequency: z.enum(["daily", "weekly", "monthly"]),
      timezone: z.string().min(1).max(100).default("UTC"),
      recipients: z.array(z.string().email()).max(25).default([]),
    })
    .optional(),
});

export const runReportSchema = z.object({
  format: z.nativeEnum(ReportFormat).optional(),
  recipients: z.array(z.string().email()).max(25).default([]),
});

export type ReportInput = z.infer<typeof reportInputSchema>;
