#!/usr/bin/env node

// Generates Supabase seed SQL from raw concept JSON data.
// Usage: `node content/scripts/build_seed_sql.mjs`

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAW_DIR = path.resolve(__dirname, "../raw");
const OUTPUT_FILE = path.resolve(
  __dirname,
  "../../infra/supabase/seeds/seed_concepts.sql"
);
const RAW_FILE = path.join(RAW_DIR, "section1_concepts.json");

function escapeLiteral(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

const conceptSchema = z.object({
  section_code: z.string().min(1),
  section_title: z.string().min(1).nullable().optional(),
  subsection_code: z.string().min(1).nullable().optional(),
  subsection_title: z.string().min(1).nullable().optional(),
  slug: z.string().min(1),
  term_lt: z.string().min(1),
  term_en: z.string().min(1).nullable().optional(),
  description_lt: z.string().min(1).nullable().optional(),
  description_en: z.string().min(1).nullable().optional(),
  source_ref: z.string().min(1).nullable().optional(),
});

function validateConcepts(records) {
  const parsed = conceptSchema.array().parse(records);
  const slugs = new Set();

  parsed.forEach((record) => {
    if (slugs.has(record.slug)) {
      throw new Error(`Duplicate slug detected: ${record.slug}`);
    }
    slugs.add(record.slug);
  });

  return parsed;
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
    source_ref
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
    updated_at = timezone('utc', now());
`;

  return `${header}${buildValuesClause(records)}${footer}`;
}

function main() {
  const rawContent = readFileSync(RAW_FILE, "utf8");
  const records = JSON.parse(rawContent);
  const parsedRecords = validateConcepts(records);

  const sql = buildSeedSql(parsedRecords);
  writeFileSync(OUTPUT_FILE, `${sql}\n`, "utf8");
  console.log(`Seed SQL regenerated at ${OUTPUT_FILE}`);
}

main();
