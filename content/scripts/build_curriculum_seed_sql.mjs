#!/usr/bin/env node

// Generates Supabase seed SQL for the curriculum hierarchy based on
// content/raw/curriculum_structure.json.

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STRUCTURE_PATH = path.resolve(
  __dirname,
  "../raw/curriculum_structure.json"
);

const OUTPUT_FILE = path.resolve(
  __dirname,
  "../../supabase/seeds/seed_curriculum.sql"
);

function escapeLiteral(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function assertStructure(data) {
  if (!data || typeof data !== "object") {
    throw new Error(
      `Expected curriculum structure JSON to be an object, received ${typeof data}`
    );
  }

  if (!Array.isArray(data.nodes) || !data.nodes.length) {
    throw new Error(
      "curriculum_structure.json is missing a non-empty 'nodes' array"
    );
  }

  if (!Array.isArray(data.items)) {
    throw new Error("curriculum_structure.json is missing an 'items' array");
  }

  return data;
}

function buildNodeValues(nodes) {
  return nodes
    .map((node) => {
      if (!node.code || !node.title || typeof node.level !== "number") {
        throw new Error(
          `Invalid node encountered: ${JSON.stringify(node, null, 2)}`
        );
      }

      return `    (${[
        escapeLiteral(node.code),
        escapeLiteral(node.title),
        escapeLiteral(node.summary ?? null),
        node.level,
        escapeLiteral(node.parent_code ?? null),
        node.ordinal ?? 1,
      ].join(", ")})`;
    })
    .join(",\n");
}

function buildItemValues(items) {
  if (!items.length) {
    return null;
  }

  return items
    .map((item) => {
      if (!item.node_code || typeof item.ordinal !== "number") {
        throw new Error(
          `Invalid curriculum item encountered: ${JSON.stringify(
            item,
            null,
            2
          )}`
        );
      }

      return `    (${[
        escapeLiteral(item.node_code),
        item.ordinal,
        escapeLiteral(item.label ?? ""),
      ].join(", ")})`;
    })
    .join(",\n");
}

function buildSql(nodes, items) {
  const header = `-- seed_curriculum.sql\n-- Generated ${new Date().toISOString()}\n\ntruncate table burburiuok.curriculum_nodes, burburiuok.curriculum_items cascade;\n\n`;

  const nodeSection = `insert into burburiuok.curriculum_nodes (\n    code,\n    title,\n    summary,\n    level,\n    parent_code,\n    ordinal\n) values\n${buildNodeValues(
    nodes
  )}\n\non conflict (code) do update set\n    title = excluded.title,\n    summary = excluded.summary,\n    level = excluded.level,\n    parent_code = excluded.parent_code,\n    ordinal = excluded.ordinal,\n    updated_at = timezone('utc', now());\n`;

  const itemValues = buildItemValues(items);

  const itemSection = itemValues
    ? `\ninsert into burburiuok.curriculum_items (\n    node_code,\n    ordinal,\n    label\n) values\n${itemValues}\n\non conflict (node_code, ordinal) do update set\n    label = excluded.label,\n    updated_at = timezone('utc', now());\n`
    : "";

  return `${header}${nodeSection}${itemSection}`;
}

function main() {
  const raw = readFileSync(STRUCTURE_PATH, "utf8");
  const parsed = assertStructure(JSON.parse(raw));

  const sql = buildSql(parsed.nodes, parsed.items);
  writeFileSync(OUTPUT_FILE, `${sql}\n`, "utf8");
  console.log(
    `Curriculum seed SQL generated at ${OUTPUT_FILE} (nodes: ${parsed.nodes.length}, items: ${parsed.items.length})`
  );
}

main();
