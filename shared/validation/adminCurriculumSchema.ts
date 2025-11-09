import { z } from "zod";

const codePattern = /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const slugPattern = /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/;

function requiredCode() {
  return z
    .string()
    .trim()
    .min(1, { message: "Kodas negali būti tuščias." })
    .max(64, { message: "Kodas negali viršyti 64 simbolių." })
    .regex(codePattern, {
      message: "Kodas gali turėti raides, skaičius, taškus ir brūkšnelius (be tarpų).",
    });
}

function requiredTitle() {
  return z
    .string()
    .trim()
    .min(1, { message: "Pavadinimas negali būti tuščias." })
    .max(240, { message: "Pavadinimas negali viršyti 240 simbolių." });
}

function optionalSummary() {
  return z
    .union([
      z
        .string()
        .trim()
        .max(1000, { message: "Santrauka negali viršyti 1000 simbolių." })
        .transform((value) => {
          const trimmed = value.trim();
          return trimmed.length ? trimmed : null;
        }),
      z.literal(null),
    ])
    .optional()
    .transform((value) => {
      if (typeof value === "undefined") {
        return undefined;
      }
      return value;
    });
}

function optionalCode() {
  return z
    .union([
      z
        .string()
        .trim()
        .min(1, { message: "Kodas negali būti tuščias." })
        .max(64, { message: "Kodas negali viršyti 64 simbolių." })
        .regex(codePattern, {
          message: "Kodas gali turėti raides, skaičius, taškus ir brūkšnelius (be tarpų).",
        })
        .transform((value) => {
          const trimmed = value.trim();
          return trimmed.length ? trimmed : null;
        }),
      z.literal(null),
    ])
    .optional()
    .transform((value) => {
      if (typeof value === "undefined") {
        return undefined;
      }
      return value;
    });
}

function requiredItemLabel() {
  return z
    .string()
    .trim()
    .min(1, { message: "Terminas negali būti tuščias." })
    .max(160, { message: "Terminas negali viršyti 160 simbolių." });
}

function optionalSlug() {
  return z
    .union([
      z
        .string()
        .trim()
        .toLowerCase()
        .min(2, { message: "Slug turi būti bent 2 simbolių." })
        .max(90, { message: "Slug negali viršyti 90 simbolių." })
        .regex(slugPattern, {
          message: "Slug gali sudaryti tik mažosios raidės, skaičiai ir brūkšneliai.",
        })
        .transform((value) => {
          const trimmed = value.trim();
          return trimmed.length ? trimmed : null;
        }),
      z.literal(null),
    ])
    .optional()
    .transform((value) => {
      if (typeof value === "undefined") {
        return undefined;
      }
      return value;
    });
}

function optionalItemText(max: number) {
  return z
    .union([
      z
        .string()
        .trim()
        .max(max, {
          message: "Tekstas negali būti ilgesnis nei " + String(max) + " simbolių.",
        })
        .transform((value) => {
          const trimmed = value.trim();
          return trimmed.length ? trimmed : null;
        }),
      z.literal(null),
    ])
    .optional()
    .transform((value) => {
      if (typeof value === "undefined") {
        return undefined;
      }
      return value;
    });
}

const ordinalSchema = z
  .number()
  .int({ message: "Eilės numeris turi būti sveikas skaičius." })
  .positive({ message: "Eilės numeris turi būti teigiamas." })
  .max(999, { message: "Eilės numeris negali viršyti 999." })
  .optional();

export const adminCurriculumNodeCreateSchema = z
  .object({
    code: optionalCode(),
    title: requiredTitle(),
    summary: optionalSummary(),
    parentCode: optionalCode(),
    ordinal: ordinalSchema,
  })
  .strict();

export const adminCurriculumNodeUpdateSchema = z
  .object({
    title: requiredTitle().optional(),
    summary: optionalSummary(),
    parentCode: optionalCode(),
    ordinal: ordinalSchema,
  })
  .strict()
  .refine((value) => {
    return (
      typeof value.title !== "undefined" ||
      typeof value.summary !== "undefined" ||
      typeof value.parentCode !== "undefined" ||
      typeof value.ordinal !== "undefined"
    );
  }, {
    message: "Bent vienas laukas turi būti pateiktas.",
  });

export type AdminCurriculumNodeCreateInput = z.infer<typeof adminCurriculumNodeCreateSchema>;
export type AdminCurriculumNodeUpdateInput = z.infer<typeof adminCurriculumNodeUpdateSchema>;

export const adminCurriculumItemCreateSchema = z
  .object({
    nodeCode: requiredCode(),
    label: requiredItemLabel(),
    conceptSlug: optionalSlug(),
    termLt: optionalItemText(160),
    termEn: optionalItemText(160),
    descriptionLt: optionalItemText(4000),
    descriptionEn: optionalItemText(4000),
    sourceRef: optionalItemText(160),
    isRequired: z.boolean().optional(),
  })
  .strict();

export type AdminCurriculumItemCreateInput = z.infer<typeof adminCurriculumItemCreateSchema>;
