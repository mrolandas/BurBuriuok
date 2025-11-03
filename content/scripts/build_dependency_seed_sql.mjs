#!/usr/bin/env node

// Generates Supabase seed SQL for curriculum prerequisites.
// Usage: `node content/scripts/build_dependency_seed_sql.mjs`
//   --check   Verify the generated SQL matches the current file.
//   --out     Override the default output path.

import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

const DATA_FILE = path.resolve(
  __dirname,
  "../raw/curriculum_dependencies.json"
);

const OUTPUT_FILE = path.resolve(
  __dirname,
  "../../supabase/seeds/seed_curriculum_dependencies.sql"
);

function parseCliArgs(rawArgs) {
  const options = {
    checkOnly: false,
    outputFile: OUTPUT_FILE,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--check") {
      options.checkOnly = true;
      continue;
    }
    if (arg === "--out") {
      const candidate = rawArgs[index + 1];
      if (!candidate) {
        console.error("Expected a file path after --out.");
        process.exit(1);
      }
      options.outputFile = path.resolve(process.cwd(), candidate);
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node content/scripts/build_dependency_seed_sql.mjs [--check] [--out <path>]"
      );
      console.log(
        "--check    Generate SQL in-memory and verify it matches the existing output file."
      );
      console.log(
        "--out      Write or compare against a different output path (default supabase/seeds/seed_curriculum_dependencies.sql)."
      );
      process.exit(0);
    }
    console.error(`Unknown argument '${arg}'. Use --help to view options.`);
    process.exit(1);
  }

  return options;
}

function escapeLiteral(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function conceptIdExpression(slug) {
  if (!slug) {
    return "NULL";
  }
  return `(select id from burburiuok.concepts where slug = ${escapeLiteral(
    slug
  )} limit 1)`;
}

const dependencySchema = z
  .object({
    source_type: z.enum(["node", "concept"]).default("node"),
    source_node_code: z.string().min(1).optional(),
    source_concept_slug: z.string().min(1).optional(),
    prerequisite_type: z.enum(["node", "concept"]).default("node"),
    prerequisite_node_code: z.string().min(1).optional(),
    prerequisite_concept_slug: z.string().min(1).optional(),
    notes: z.string().min(1).nullable().optional(),
    created_by: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.source_type === "node") {
      if (!value.source_node_code) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "source_node_code is required when source_type is 'node'",
          path: ["source_node_code"],
        });
      }
      if (value.source_concept_slug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "source_concept_slug must be omitted when source_type is 'node'",
          path: ["source_concept_slug"],
        });
      }
    } else if (value.source_type === "concept") {
      if (!value.source_concept_slug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "source_concept_slug is required when source_type is 'concept'",
          path: ["source_concept_slug"],
        });
      }
      if (value.source_node_code) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "source_node_code must be omitted when source_type is 'concept'",
          path: ["source_node_code"],
        });
      }
    }

    if (value.prerequisite_type === "node") {
      if (!value.prerequisite_node_code) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "prerequisite_node_code is required when prerequisite_type is 'node'",
          path: ["prerequisite_node_code"],
        });
      }
      if (value.prerequisite_concept_slug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "prerequisite_concept_slug must be omitted when prerequisite_type is 'node'",
          path: ["prerequisite_concept_slug"],
        });
      }
    } else if (value.prerequisite_type === "concept") {
      if (!value.prerequisite_concept_slug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "prerequisite_concept_slug is required when prerequisite_type is 'concept'",
          path: ["prerequisite_concept_slug"],
        });
      }
      if (value.prerequisite_node_code) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "prerequisite_node_code must be omitted when prerequisite_type is 'concept'",
          path: ["prerequisite_node_code"],
        });
      }
    }
  });

const dependencyFileSchema = z.object({
  dependencies: dependencySchema.array().default([]),
});

function loadDependencies() {
  if (!existsSync(DATA_FILE)) {
    throw new Error(
      `Missing curriculum dependency source at ${DATA_FILE}. Create the file before running this script.`
    );
  }
  const raw = readFileSync(DATA_FILE, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Unable to parse ${DATA_FILE} as JSON: ${
        (error && error.message) || error
      }`
    );
  }
  const { dependencies } = dependencyFileSchema.parse(parsed);
  return dependencies.map((dependency) => ({
    ...dependency,
    created_by: dependency.created_by ?? "seed_script",
  }));
}

function buildSql(dependencies) {
  const header = `-- seed_curriculum_dependencies.sql\n-- Generated ${new Date().toISOString()}\n\n`;

  if (!dependencies.length) {
    return `${header}-- No curriculum dependencies defined.\n`;
  }

  const rows = dependencies
    .map((dependency) => {
      const sourceNodeCode =
        dependency.source_type === "node"
          ? escapeLiteral(dependency.source_node_code)
          : "NULL";
      const sourceConceptId =
        dependency.source_type === "concept"
          ? conceptIdExpression(dependency.source_concept_slug)
          : "NULL";
      const prerequisiteNodeCode =
        dependency.prerequisite_type === "node"
          ? escapeLiteral(dependency.prerequisite_node_code)
          : "NULL";
      const prerequisiteConceptId =
        dependency.prerequisite_type === "concept"
          ? conceptIdExpression(dependency.prerequisite_concept_slug)
          : "NULL";
      const notes = dependency.notes ? escapeLiteral(dependency.notes) : "NULL";

      return `    (${[
        escapeLiteral(dependency.source_type),
        sourceConceptId,
        sourceNodeCode,
        escapeLiteral(dependency.prerequisite_type),
        prerequisiteConceptId,
        prerequisiteNodeCode,
        notes,
        escapeLiteral(dependency.created_by),
      ].join(", ")})`;
    })
    .join(",\n");

  const allNodeToNode = dependencies.every(
    (dependency) =>
      dependency.source_type === "node" &&
      dependency.prerequisite_type === "node"
  );

  const conflictClause = allNodeToNode
    ? "on conflict on constraint curriculum_dependencies_node_to_node_uniq do update set\n    notes = excluded.notes,\n    created_by = excluded.created_by;\n"
    : "on conflict do nothing;\n";

  return (
    `${header}insert into burburiuok.curriculum_dependencies (\n` +
    `    source_type,\n` +
    `    source_concept_id,\n` +
    `    source_node_code,\n` +
    `    prerequisite_type,\n` +
    `    prerequisite_concept_id,\n` +
    `    prerequisite_node_code,\n` +
    `    notes,\n` +
    `    created_by\n` +
    `) values\n${rows}\n\n${conflictClause}`
  );
}

function normalizeSqlForComparison(content) {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/^-- Generated .*$/m, "-- Generated <normalized>")
    .trimEnd();
}

const cliOptions = parseCliArgs(process.argv.slice(2));

const dependencies = loadDependencies();
const sql = `${buildSql(dependencies)}\n`;

if (cliOptions.checkOnly) {
  if (!existsSync(cliOptions.outputFile)) {
    console.error(
      `Dependency seed SQL missing at ${cliOptions.outputFile}. Run npm run content:seed:dependencies to generate it.`
    );
    process.exit(1);
  }
  const existing = readFileSync(cliOptions.outputFile, "utf8");
  const normalizedExisting = normalizeSqlForComparison(existing);
  const normalizedGenerated = normalizeSqlForComparison(sql);
  if (normalizedExisting !== normalizedGenerated) {
    console.error(
      "Generated curriculum dependency seed SQL is out of date. Run npm run content:seed:dependencies."
    );
    process.exit(1);
  }
  process.exit(0);
}

writeFileSync(cliOptions.outputFile, sql, "utf8");
console.log(
  `Curriculum dependency seed SQL generated at ${cliOptions.outputFile} (rows: ${dependencies.length}).`
);
