#!/usr/bin/env node
/**
 * Migration script: Converts legacy curriculum codes to unified format
 *
 * Old format: "1", "1.1a", "1.1.1", "10.17"
 * New format: "LBS-1", "LBS-1-1A", "LBS-1-1-1", "LBS-10-17"
 *
 * This enables future multi-subject support where each subject has its own prefix.
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUBJECT_PREFIX = "LBS"; // Laivo Buriuotojo Sertifikatas

// Convert legacy code to unified format
// Examples: "1" -> "LBS-1", "1.1a" -> "LBS-1-1A", "10.17" -> "LBS-10-17"
function convertCode(legacyCode) {
  if (!legacyCode) return null;

  // Already converted?
  if (legacyCode.startsWith(`${SUBJECT_PREFIX}-`)) {
    return legacyCode;
  }

  // Split by dots, convert to uppercase, join with dashes
  const parts = legacyCode.split(".").map((part) => part.toUpperCase());
  return `${SUBJECT_PREFIX}-${parts.join("-")}`;
}

// Convert slug format to match new codes
// Examples: "1-1a-jole" -> "lbs-1-1a-jole"
function convertSlug(legacySlug) {
  if (!legacySlug) return null;

  // Already converted?
  if (legacySlug.startsWith("lbs-")) {
    return legacySlug;
  }

  return `lbs-${legacySlug}`;
}

function migrateCurriculumStructure() {
  const filePath = path.resolve(
    __dirname,
    "../content/raw/curriculum_structure.json"
  );
  const data = JSON.parse(readFileSync(filePath, "utf-8"));

  // Migrate nodes
  data.nodes = data.nodes.map((node) => ({
    ...node,
    code: convertCode(node.code),
    parent_code: node.parent_code ? convertCode(node.parent_code) : null,
  }));

  // Migrate items
  data.items = data.items.map((item) => ({
    ...item,
    node_code: convertCode(item.node_code),
  }));

  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  console.log(
    `✅ Migrated curriculum_structure.json (${data.nodes.length} nodes, ${data.items.length} items)`
  );
}

function migrateConceptFiles() {
  const conceptFiles = [
    "topic_1_concepts.json",
    "topic_2_concepts.json",
    "topic_3_concepts.json",
    "topic_4_concepts.json",
    "topic_6_concepts.json",
    "topic_7_concepts.json",
    "topic_8_concepts.json",
    "topic_9_concepts.json",
    "topic_10_concepts.json",
  ];

  let totalConcepts = 0;

  for (const filename of conceptFiles) {
    const filePath = path.resolve(__dirname, "../content/raw", filename);

    try {
      const concepts = JSON.parse(readFileSync(filePath, "utf-8"));

      const migrated = concepts.map((concept) => ({
        ...concept,
        section_code: convertCode(concept.section_code),
        subsection_code: concept.subsection_code
          ? convertCode(concept.subsection_code)
          : null,
        slug: convertSlug(concept.slug),
        curriculum_node_code: concept.curriculum_node_code
          ? convertCode(concept.curriculum_node_code)
          : null,
      }));

      writeFileSync(filePath, JSON.stringify(migrated, null, 2) + "\n");
      totalConcepts += migrated.length;
      console.log(`✅ Migrated ${filename} (${migrated.length} concepts)`);
    } catch (err) {
      if (err.code === "ENOENT") {
        console.log(`⏭️  Skipped ${filename} (not found)`);
      } else {
        throw err;
      }
    }
  }

  console.log(`\n📊 Total concepts migrated: ${totalConcepts}`);
}

function migrateDependencies() {
  const filePath = path.resolve(
    __dirname,
    "../content/raw/curriculum_dependencies.json"
  );

  try {
    const data = JSON.parse(readFileSync(filePath, "utf-8"));

    // Handle both array format and object with dependencies array
    const deps = Array.isArray(data) ? data : data.dependencies;

    const migrated = deps.map((dep) => ({
      ...dep,
      source_node_code: convertCode(dep.source_node_code),
      prerequisite_node_code: convertCode(dep.prerequisite_node_code),
    }));

    const output = Array.isArray(data) ? migrated : { dependencies: migrated };

    writeFileSync(filePath, JSON.stringify(output, null, 2) + "\n");
    console.log(
      `✅ Migrated curriculum_dependencies.json (${migrated.length} dependencies)`
    );
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log(`⏭️  Skipped curriculum_dependencies.json (not found)`);
    } else {
      throw err;
    }
  }
}

console.log("🔄 Migrating to unified code format...\n");
console.log(`Subject prefix: ${SUBJECT_PREFIX}\n`);

migrateCurriculumStructure();
migrateConceptFiles();
migrateDependencies();

console.log("\n✅ Migration complete!");
console.log("\nNext steps:");
console.log("1. Run: npm run content:seed:curriculum");
console.log("2. Run: npm run content:seed:generate");
console.log("3. Run: npm run content:seed:dependencies");
console.log("4. Reset database: npx supabase db reset");
