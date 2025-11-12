#!/usr/bin/env node

// Validates the canonical concept markdown to catch format regressions
// before regenerating Supabase seeds.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const masterMarkdownPath = path.resolve(
  repoRoot,
  "docs/static_info/LBS_concepts_master.md"
);

function stripFormatting(cell = "") {
  return cell.replace(/[`*_]/g, "").trim();
}

function parseCells(rawLine) {
  const trimmed = rawLine.trim();
  if (!trimmed.startsWith("|") || trimmed.length < 2) {
    return null;
  }
  const body = trimmed.slice(1, trimmed.endsWith("|") ? -1 : trimmed.length);
  return body.split("|").map((cell) => cell.trim());
}

function isDividerRow(cells = []) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell));
}

function normaliseHeader(value = "") {
  return stripFormatting(value).toLowerCase();
}

function validateConceptTable(buffer, context) {
  if (!buffer.length) {
    return { errors: [], tables: 0, rows: 0 };
  }

  const headerCells = parseCells(buffer[0].line);
  if (!headerCells || !headerCells.length) {
    return { errors: [], tables: 0, rows: 0 };
  }

  const headerLabels = headerCells.map(normaliseHeader);

  const headerAliases = {
    termLt: ["term lt", "sąvoka lt", "savoka lt"],
    termEn: ["term en", "sąvoka en", "savoka en"],
    definition: ["apibrėžimas", "aprasymas", "aprašymas"],
  };

  const findHeaderIndex = (aliases) =>
    headerLabels.findIndex((label) => aliases.includes(label));

  const termLtIndex = findHeaderIndex(headerAliases.termLt);
  const termEnIndex = findHeaderIndex(headerAliases.termEn);
  const definitionIndex = findHeaderIndex(headerAliases.definition);

  const isConceptTable =
    termLtIndex !== -1 && termEnIndex !== -1 && definitionIndex !== -1;

  if (!isConceptTable) {
    return { errors: [], tables: 0, rows: 0 };
  }

  const errors = [];
  const tableStartLine = buffer[0].lineNumber;
  const requiredColumns = [
    { index: termLtIndex, label: "Sąvoka LT" },
    { index: termEnIndex, label: "Sąvoka EN" },
    { index: definitionIndex, label: "Apibrėžimas" },
  ];

  requiredColumns.forEach(({ index, label }) => {
    if (index === -1) {
      errors.push(
        `Line ${tableStartLine}: Missing required column '${label}' in table (${
          context.section ?? context.topic ?? "unknown section"
        }).`
      );
    }
  });

  const seenTerms = new Set();
  let dataRows = 0;

  for (let i = 1; i < buffer.length; i += 1) {
    const { line, lineNumber } = buffer[i];
    const cells = parseCells(line);
    if (!cells || isDividerRow(cells)) {
      continue;
    }

    if (cells.length !== headerCells.length) {
      errors.push(
        `Line ${lineNumber}: Row has ${cells.length} cells, expected ${
          headerCells.length
        } (${context.section ?? context.topic ?? "unknown section"}).`
      );
      continue;
    }

    const termLtRaw = cells[termLtIndex] ?? "";
    const definitionRaw = definitionIndex >= 0 ? cells[definitionIndex] : "";
    const termLt = stripFormatting(termLtRaw);
    const definition = stripFormatting(definitionRaw);

    if (!termLt) {
      errors.push(
        `Line ${lineNumber}: 'Sąvoka (LT)' must not be empty (${
          context.section ?? context.topic ?? "unknown section"
        }).`
      );
    }

    if (!definition) {
      errors.push(
        `Line ${lineNumber}: 'Apibrėžimas' must not be empty for term '${termLtRaw}' (${
          context.section ?? context.topic ?? "unknown section"
        }).`
      );
    }

    const duplicateKey = termLt.toLowerCase();
    if (duplicateKey) {
      if (seenTerms.has(duplicateKey)) {
        errors.push(
          `Line ${lineNumber}: Duplicate 'Sąvoka (LT)' entry '${termLtRaw}' within the same table (${
            context.section ?? context.topic ?? "unknown section"
          }).`
        );
      } else {
        seenTerms.add(duplicateKey);
      }
    }

    dataRows += 1;
  }

  if (dataRows === 0) {
    errors.push(
      `Line ${tableStartLine}: Table must contain at least one data row (${
        context.section ?? context.topic ?? "unknown section"
      }).`
    );
  }

  return {
    errors,
    tables: 1,
    rows: dataRows,
  };
}

function main() {
  const markdown = readFileSync(masterMarkdownPath, "utf8");
  const lines = markdown.split(/\r?\n/);

  let currentTopic = null;
  let currentSection = null;
  let tableBuffer = [];

  const aggregate = {
    errors: [],
    tables: 0,
    rows: 0,
  };

  const flushTable = () => {
    if (!tableBuffer.length) {
      return;
    }
    const result = validateConceptTable(tableBuffer, {
      topic: currentTopic,
      section: currentSection,
    });
    aggregate.errors.push(...result.errors);
    aggregate.tables += result.tables;
    aggregate.rows += result.rows;
    tableBuffer = [];
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (trimmed.startsWith("### ")) {
      flushTable();
      currentSection = stripFormatting(trimmed.replace(/^###\s+/, ""));
      return;
    }

    if (trimmed.startsWith("## ")) {
      flushTable();
      currentTopic = stripFormatting(trimmed.replace(/^##\s+/, ""));
      currentSection = null;
      return;
    }

    if (trimmed.startsWith("|")) {
      tableBuffer.push({ line, lineNumber });
    } else {
      flushTable();
    }
  });

  flushTable();

  if (aggregate.errors.length) {
    console.error("Concept markdown validation failed:");
    aggregate.errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(
    `✔ Concept markdown validated (${aggregate.tables} tables, ${aggregate.rows} rows checked)`
  );
}

main();
