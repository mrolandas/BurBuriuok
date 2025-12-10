#!/usr/bin/env node

// Export the curriculum hierarchy in either tree or CSV format.
// Usage examples:
//   node tests/exportCurriculumTree.mjs
//   node tests/exportCurriculumTree.mjs --format csv --out content/source/curriculum_in_supabase.csv

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const ARGUMENTS = new Map();

function parseArgs(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--format") {
      if (index + 1 >= argv.length) {
        throw new Error("--format requires a value (tree or csv)");
      }
      ARGUMENTS.set("format", argv[index + 1]);
      index += 1;
    } else if (token === "--out") {
      if (index + 1 >= argv.length) {
        throw new Error("--out requires a file path");
      }
      ARGUMENTS.set("out", argv[index + 1]);
      index += 1;
    } else if (token === "--help" || token === "-h") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
}

function printUsage() {
  console.log("Curriculum export utility");
  console.log(
    "Usage: node tests/exportCurriculumTree.mjs [--format tree|csv] [--out relative/path.csv]"
  );
}

function loadCurriculumStructure() {
  const structurePath = path.resolve(
    repoRoot,
    "content/raw/curriculum_structure.json"
  );
  const raw = readFileSync(structurePath, "utf8");
  return JSON.parse(raw);
}

function buildHierarchy(data) {
  const nodesMap = new Map();
  data.nodes.forEach((node) => {
    nodesMap.set(node.code, { ...node, children: [] });
  });

  data.nodes.forEach((node) => {
    if (!node.parent_code) {
      return;
    }
    const parent = nodesMap.get(node.parent_code);
    if (parent) {
      parent.children.push(nodesMap.get(node.code));
    }
  });

  const rootNodes = data.nodes
    .filter((node) => !node.parent_code)
    .map((node) => nodesMap.get(node.code));

  rootNodes.forEach((node) => sortHierarchy(node));

  const itemsByNode = new Map();
  data.items.forEach((item) => {
    if (!itemsByNode.has(item.node_code)) {
      itemsByNode.set(item.node_code, []);
    }
    itemsByNode.get(item.node_code).push(item);
  });

  itemsByNode.forEach((items) =>
    items.sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
  );

  return { rootNodes, itemsByNode };
}

function sortHierarchy(node) {
  node.children.sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
  node.children.forEach((child) => sortHierarchy(child));
}

function buildTreeLines(nodes, itemsByNode) {
  const lines = [];

  function formatNode(node, depth = 0) {
    const indent = "  ".repeat(depth);
    lines.push(`${indent}${node.code} ${node.title}`);

    const items = itemsByNode.get(node.code) ?? [];
    items.forEach((item) => {
      lines.push(`${indent}  - [${item.ordinal}] ${item.label}`);
    });

    node.children.forEach((child) => formatNode(child, depth + 1));
  }

  nodes.forEach((node) => formatNode(node));
  return lines;
}

function buildCsv(lines) {
  const escaped = lines.map((line) => `"${line.replace(/"/g, '""')}"`);
  return ["hierarchy_line", ...escaped].join("\n");
}

function main() {
  try {
    parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    printUsage();
    process.exit(1);
  }

  const format = (ARGUMENTS.get("format") ?? "tree").toLowerCase();
  if (!["tree", "csv"].includes(format)) {
    console.error(`Unsupported format: ${format}`);
    printUsage();
    process.exit(1);
  }

  const curriculum = loadCurriculumStructure();
  const { rootNodes, itemsByNode } = buildHierarchy(curriculum);
  const treeLines = buildTreeLines(rootNodes, itemsByNode);

  const output = format === "tree" ? treeLines.join("\n") : buildCsv(treeLines);
  const outPath = ARGUMENTS.get("out");

  if (outPath) {
    const destination = path.resolve(repoRoot, outPath);
    writeFileSync(destination, `${output}\n`, "utf8");
    const relativePath = path.relative(repoRoot, destination) || ".";
    console.log(`Wrote ${format.toUpperCase()} export to ${relativePath}`);
  } else {
    console.log(output);
  }
}

main();
