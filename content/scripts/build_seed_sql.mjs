#!/usr/bin/env node

// Generates Supabase seed SQL from raw concept JSON data.
// Usage: `node content/scripts/build_seed_sql.mjs`

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

import { applyCurriculumRequirements } from "./lib/curriculum.mjs";

let z;
try {
  ({ z } = await import("zod"));
} catch (error) {
  console.error(
    "Missing dependency 'zod'. Install it locally with `npm install zod` before running this script."
  );
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAW_DIR = path.resolve(__dirname, "../raw");
const OUTPUT_FILE = path.resolve(
  __dirname,
  "../../supabase/seeds/seed_concepts.sql"
);

function escapeLiteral(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function formatBoolean(value) {
  return value ? "true" : "false";
}

const conceptSchema = z.object({
  section_code: z.string().min(1),
  section_title: z.string().nullable().optional(),
  subsection_code: z.string().nullable().optional(),
  subsection_title: z.string().nullable().optional(),
  slug: z.string().min(1),
  term_lt: z.string().min(1),
  term_en: z.string().nullable().optional(),
  description_lt: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  source_ref: z.string().nullable().optional(),
  is_required: z.boolean().optional(),
});

function loadConceptRecords() {
  const files = readdirSync(RAW_DIR)
    .filter((file) => /_(concepts|section_[a-z0-9_]+)\.json$/i.test(file))
    .sort();

  if (!files.length) {
    throw new Error(
      `No section concept files found in ${RAW_DIR}. Run extract_prototype_content.mjs first.`
    );
  }

  const combined = [];
  for (const file of files) {
    const absolutePath = path.join(RAW_DIR, file);
    const rawContent = readFileSync(absolutePath, "utf8");
    const parsed = conceptSchema.array().parse(JSON.parse(rawContent));
    combined.push(...parsed);
  }

  const slugSet = new Set();
  combined.forEach((record) => {
    if (slugSet.has(record.slug)) {
      throw new Error(`Duplicate slug detected: ${record.slug}`);
    }
    slugSet.add(record.slug);
  });

  return combined;
}

function buildValuesClause(records) {
  const rows = records.map((record) => {
    const columns = [
      escapeLiteral(record.section_code),
      escapeLiteral(record.section_title ?? null),
      escapeLiteral(record.subsection_code ?? null),
      escapeLiteral(record.subsection_title ?? null),
      escapeLiteral(record.slug),
      escapeLiteral(record.term_lt),
      escapeLiteral(record.term_en ?? null),
      escapeLiteral(record.description_lt ?? null),
      escapeLiteral(record.description_en ?? null),
      escapeLiteral(record.source_ref ?? null),
      formatBoolean(record.is_required === true),
    ];
    return `    (${columns.join(", ")})`;
  });

  return rows.join(",\n");
}

function buildSeedSql(records) {
  const header = `-- seed_concepts.sql
-- Generated ${new Date().toISOString()}

insert into burburiuok.concepts (
    section_code,
    section_title,
    subsection_code,
    subsection_title,
    slug,
    term_lt,
    term_en,
    description_lt,
    description_en,
    source_ref,
    is_required
) values
`;

  const footer = `

on conflict (slug) do update set
    section_code = excluded.section_code,
    section_title = excluded.section_title,
    subsection_code = excluded.subsection_code,
    subsection_title = excluded.subsection_title,
    term_lt = excluded.term_lt,
    term_en = excluded.term_en,
    description_lt = excluded.description_lt,
    description_en = excluded.description_en,
    source_ref = excluded.source_ref,
    is_required = excluded.is_required,
    updated_at = timezone('utc', now());
`;

  return `${header}${buildValuesClause(records)}${footer}`;
}

function main() {
  const parsedRecords = loadConceptRecords();
  const { records: enrichedRecords, summary } =
    applyCurriculumRequirements(parsedRecords);

  const sql = buildSeedSql(enrichedRecords);
  writeFileSync(OUTPUT_FILE, `${sql}\n`, "utf8");
  console.log(
    `Seed SQL regenerated at ${OUTPUT_FILE} (required: ${summary.required}, optional: ${summary.optional})`
  );
}

main();
