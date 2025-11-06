import { z } from "zod";

export const adminConceptStatusSchema = z.enum(["draft", "published"]);

const slugPattern = /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/;

function requiredText(min: number, max?: number) {
  let schema = z.string().trim();
  schema = schema.min(min, {
    message: "Tekstas turi būti bent " + String(min) + " simbolių ilgio.",
  });
  if (typeof max === "number") {
    schema = schema.max(max, {
      message: "Tekstas negali būti ilgesnis nei " + String(max) + " simbolių.",
    });
  }
  return schema;
}

function optionalText(max?: number) {
  let schema = z
    .string()
    .trim()
    .min(1, { message: "Įveskite bent vieną simbolį arba palikite lauką tuščią." });

  if (typeof max === "number") {
    schema = schema.max(max, {
      message: "Tekstas negali būti ilgesnis nei " + String(max) + " simbolių.",
    });
  }

  return schema.nullable().optional().transform((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }
    return value ?? null;
  });
}

function optionalCode(max?: number) {
  let schema = z
    .string()
    .trim()
    .min(1, { message: "Kodas negali būti tuščias." });

  if (typeof max === "number") {
    schema = schema.max(max, {
      message: "Kodas negali būti ilgesnis nei " + String(max) + " simbolių.",
    });
  }

  return schema.nullable().optional().transform((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }
    return value ?? null;
  });
}

export const adminConceptMutationSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2, { message: "Slug turi būti bent 2 simbolių." })
      .max(90, { message: "Slug negali viršyti 90 simbolių." })
      .regex(slugPattern, {
        message: "Slug gali sudaryti tik mažosios raidės, skaičiai ir brūkšneliai.",
      }),
    termLt: requiredText(1, 160),
    termEn: optionalText(160),
    descriptionLt: requiredText(1, 4000),
    descriptionEn: optionalText(4000),
    sectionCode: requiredText(1, 32),
    sectionTitle: requiredText(1, 160),
    subsectionCode: optionalCode(32),
    subsectionTitle: optionalText(160),
    curriculumNodeCode: optionalCode(32),
    curriculumItemOrdinal: z
      .number()
      .int({ message: "Skaičius turi būti sveikas." })
      .nonnegative({ message: "Negalima įvesti neigiamo skaičiaus." })
      .nullable()
      .optional()
      .transform((value) => (typeof value === "number" ? value : null)),
    curriculumItemLabel: optionalText(160),
    sourceRef: optionalText(160),
  isRequired: z.boolean(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    status: adminConceptStatusSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const metadataStatus =
      typeof value.metadata?.status === "string"
        ? value.metadata.status
        : null;

    if (metadataStatus && metadataStatus !== value.status) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["metadata", "status"],
        message: "Metaduomenų būsena turi sutapti su pasirinkta būsena.",
      });
    }
  });

export type AdminConceptMutationInput = z.infer<typeof adminConceptMutationSchema>;