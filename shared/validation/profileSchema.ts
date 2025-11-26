import { z } from "zod";

export const profileRoleSchema = z.enum(["learner", "admin", "contributor"]);
export const preferredLanguageSchema = z.enum(["lt", "en"]);

const callsignSchema = z
  .string()
  .trim()
  .min(2, { message: "Kviesinys turi būti bent 2 simbolių." })
  .max(60, { message: "Kviesinys negali viršyti 60 simbolių." });

export const inviteTokenSchema = z
  .string()
  .trim()
  .min(16, { message: "Kvietimo nuoroda neteisinga." })
  .max(200, { message: "Kvietimo nuoroda per ilga." });

export const profileUpsertSchema = z.object({
  preferredLanguage: preferredLanguageSchema.optional(),
  callsign: callsignSchema.nullable().optional(),
  inviteToken: inviteTokenSchema.optional(),
});

export type ProfileUpsertInput = z.infer<typeof profileUpsertSchema>;
export type PreferredLanguage = z.infer<typeof preferredLanguageSchema>;
export type ProfileRole = z.infer<typeof profileRoleSchema>;
