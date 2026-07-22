import { z } from "zod";

export const insightRequestSchema = z.object({
  organizationId: z.string().uuid(),
  datasetId: z.string().uuid(),
  mapping: z.object({
    date: z.string().min(1),
    revenue: z.string().min(1),
    customerId: z.string().min(1).optional(),
    product: z.string().min(1).optional(),
    churned: z.string().min(1).optional(),
  }),
});
export type InsightRequest = z.infer<typeof insightRequestSchema>;
