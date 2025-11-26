import { z } from "zod";

export const magicLinkRequestSchema = z
  .object({
    email: z
      .string()
      .min(1, "Email is required.")
      .max(320, "Email must be 320 characters or fewer.")
      .email("Provide a valid email address."),
    redirectTo: z
      .string()
      .max(500, "redirectTo is too long.")
      .optional(),
  })
  .strict();

export type MagicLinkRequestBody = z.infer<typeof magicLinkRequestSchema>;
