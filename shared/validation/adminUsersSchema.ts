import { z } from "zod";
import { profileRoleSchema } from "./profileSchema";

export const adminInviteRequestSchema = z.object({
  email: z
    .string()
    .email({ message: "Įveskite galiojantį el. pašto adresą." })
    .transform((value) => value.trim().toLowerCase()),
  role: profileRoleSchema.default("admin"),
  expiresInHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 14)
    .optional(),
});

export const adminRoleUpdateSchema = z.object({
  role: profileRoleSchema,
});

export type AdminInviteRequestInput = z.infer<typeof adminInviteRequestSchema>;
export type AdminRoleUpdateInput = z.infer<typeof adminRoleUpdateSchema>;
