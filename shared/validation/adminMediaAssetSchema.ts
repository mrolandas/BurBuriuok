import { z } from "zod";

export const adminMediaAssetTypeSchema = z.enum(["image", "video"]);
export const adminMediaSourceKindSchema = z.enum(["upload", "external"]);

function optionalTrimmed(max?: number) {
  let schema = z.string().trim();

  if (typeof max === "number") {
    schema = schema.max(max, {
      message: "Tekstas negali būti ilgesnis nei " + String(max) + " simbolių.",
    });
  }

  return schema
    .or(z.null())
    .optional()
    .transform((value) => {
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    });
}

function requiredTrimmed(max?: number) {
  let schema = z.string().trim().min(1, {
    message: "Šis laukas yra privalomas.",
  });

  if (typeof max === "number") {
    schema = schema.max(max, {
      message: "Tekstas negali būti ilgesnis nei " + String(max) + " simbolių.",
    });
  }

  return schema.transform((value) => value.trim());
}

const adminMediaUploadSourceSchema = z.object({
  kind: z.literal("upload"),
  fileName: z
    .string()
    .trim()
    .min(1, { message: "Failo pavadinimas privalomas." })
    .max(160, { message: "Failo pavadinimas negali viršyti 160 simbolių." }),
  fileSize: z
    .number()
    .int({ message: "Failo dydis turi būti sveikas skaičius." })
    .positive({ message: "Failo dydis turi būti teigiamas." })
    .max(50 * 1024 * 1024, { message: "Failas negali būti didesnis nei 50 MB." }),
  contentType: z
    .string()
    .trim()
    .min(1, { message: "Turinio tipas privalomas." })
    .max(120, { message: "Turinio tipas negali viršyti 120 simbolių." }),
});

const adminMediaExternalSourceSchema = z.object({
  kind: z.literal("external"),
  url: z
    .string()
    .trim()
    .url({ message: "Neteisingas URL formatas." })
    .max(500, { message: "URL negali viršyti 500 simbolių." }),
});

export const adminMediaCreateSchema = z
  .object({
    conceptId: z.string().uuid({ message: "Koncepto ID turi būti UUID." }),
    assetType: adminMediaAssetTypeSchema,
    title: requiredTrimmed(160),
    captionLt: optionalTrimmed(300),
    captionEn: optionalTrimmed(300),
    source: z.discriminatedUnion("kind", [
      adminMediaUploadSourceSchema,
      adminMediaExternalSourceSchema,
    ]),
  })
  .strict();

export type AdminMediaCreateInput = z.infer<typeof adminMediaCreateSchema>;
export type AdminMediaUploadSourceInput = z.infer<typeof adminMediaUploadSourceSchema>;
export type AdminMediaExternalSourceInput = z.infer<typeof adminMediaExternalSourceSchema>;
export type AdminMediaSourceKind = z.infer<typeof adminMediaSourceKindSchema>;

export const adminMediaListQuerySchema = z
  .object({
    conceptId: z.string().uuid().optional(),
    assetType: adminMediaAssetTypeSchema.optional(),
    sourceKind: adminMediaSourceKindSchema.optional(),
    search: z
      .string()
      .trim()
      .min(2, { message: "Paieškos užklausa turi būti bent 2 simbolių." })
      .max(80, { message: "Paieškos užklausa negali viršyti 80 simbolių." })
      .optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().optional(),
  })
  .strict();

export type AdminMediaListQuery = z.infer<typeof adminMediaListQuerySchema>;

export const adminMediaSignedUrlQuerySchema = z
  .object({
    expiresIn: z.coerce.number().int().min(60).max(3600).default(3600),
    variant: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type AdminMediaSignedUrlQuery = z.infer<typeof adminMediaSignedUrlQuerySchema>;
