import { z } from "zod";

export const chatRequestSchema = z
  .object({
    organizationId: z.string().uuid(),
    conversationId: z.string().uuid().optional(),
    datasetId: z.string().uuid().optional(),
    question: z.string().trim().min(2).max(1_000).optional(),
    regenerateMessageId: z.string().uuid().optional(),
  })
  .refine(
    (value) => Boolean(value.question) !== Boolean(value.regenerateMessageId),
    "Provide either a question or a message to regenerate.",
  );
