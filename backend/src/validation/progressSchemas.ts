import { z } from "zod";

export const progressStatusSchema = z.enum(["learning", "known", "review", "seen"]);

export const upsertProgressBodySchema = z
  .object({
    status: progressStatusSchema.optional(),
    lastReviewedAt: z
      .string()
      .datetime({ message: "lastReviewedAt must be an ISO-8601 timestamp." })
      .optional(),
  })
  .strict();

export type UpsertProgressBody = z.infer<typeof upsertProgressBodySchema>;
