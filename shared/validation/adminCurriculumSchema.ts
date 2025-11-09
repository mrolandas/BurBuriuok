import { z } from "zod";

const codePattern = /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;

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
        .max(1000, { message: "Santrauka negali viršyti 1000 simbolių." }),
      z.literal(null),
    ])
    .optional();
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
        }),
      z.literal(null),
    ])
    .optional();
}

const ordinalSchema = z
  .number()
  .int({ message: "Eilės numeris turi būti sveikas skaičius." })
  .positive({ message: "Eilės numeris turi būti teigiamas." })
  .max(999, { message: "Eilės numeris negali viršyti 999." })
  .optional();

export const adminCurriculumNodeCreateSchema = z
  .object({
    code: requiredCode(),
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
