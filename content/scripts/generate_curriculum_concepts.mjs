#!/usr/bin/env node

/**
 * Generates concept JSON files for all curriculum topics from LBS_programa.md
 * Creates structured concept entries from the official curriculum document
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CURRICULUM_PATH = path.resolve(__dirname, "../source/LBS_programa.md");
const OUTPUT_DIR = path.resolve(__dirname, "../raw");

// Ensure output directory exists
mkdirSync(OUTPUT_DIR, { recursive: true });

function sanitizeSlug(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseLines(lines) {
  const topics = [];
  const stack = [];
  let lastNode = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const numberedMatch = rawLine.match(
      /^\s*(\d+(?:\.\d+)*)(\.)?(?:\s+(.*))?$/u
    );

    if (numberedMatch) {
      const baseNumber = numberedMatch[1];
      const hasTrailingDot = Boolean(numberedMatch[2]);
      const remainder = numberedMatch[3] ?? "";

      const numberSegments = baseNumber.split(".").filter(Boolean);
      let level = numberSegments.length || 1;

      const topOfStack = stack[stack.length - 1];
      if (hasTrailingDot && topOfStack && topOfStack.numberKey === baseNumber) {
        level = topOfStack.level + 1;
      }

      const node = {
        numberRaw: `${baseNumber}${hasTrailingDot ? "." : ""}`,
        numberKey: baseNumber,
        level,
        rawText: remainder.trim(),
        title: "",
        items: [],
        subsections: [],
      };

      while (stack.length >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        topics.push(node);
      } else {
        const parent = stack[stack.length - 1];
        parent.subsections.push(node);
      }

      stack.push(node);
      lastNode = node;
    } else if (lastNode) {
      lastNode.rawText = `${lastNode.rawText} ${trimmed}`.trim();
    }
  }

  return topics;
}

function splitItemsPreservingParentheses(text) {
  const items = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    }

    if (char === "," && depth === 0) {
      items.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items;
}

function finalizeNode(node) {
  const text = node.rawText.trim();

  if (!text) {
    node.title = "";
  } else {
    const colonIndex = text.indexOf(":");
    const hasItems = colonIndex !== -1 && colonIndex < text.length - 1;

    if (hasItems && node.subsections.length === 0) {
      node.title = text.slice(0, colonIndex).replace(/\.+$/u, "").trim();
      const itemsText = text.slice(colonIndex + 1).trim();
      node.items = splitItemsPreservingParentheses(itemsText);
    } else {
      node.title = hasItems ? text.trim() : text.replace(/\.+$/u, "").trim();
    }
  }

  node.subsections.forEach(finalizeNode);
}

function nodeToConceptRecords(node, parentPath = [], topicNumber = 1) {
  const records = [];
  const currentPath = [...parentPath, node.numberRaw.replace(/\.$/u, "")];
  const sectionCode = currentPath.join(".");

  // If this node has items, create a concept record for each item
  if (node.items.length > 0) {
    node.items.forEach((item) => {
      const term = item.trim();
      const slug = sanitizeSlug(
        `${topicNumber}-${sectionCode}-${term}`.substring(0, 100)
      );

      records.push({
        section_code: sectionCode,
        section_title: node.title || "",
        subsection_code: null,
        subsection_title: null,
        slug,
        term_lt: term,
        term_en: "",
        description_lt: "",
        description_en: "",
        source_ref: "LBS_programa.md",
        metadata: {
          curriculum_required: true,
          topic_number: topicNumber,
          parent_section: node.title,
        },
      });
    });
  } else if (!node.subsections.length && node.title) {
    // Leaf node without explicit items - treat the title itself as a concept
    const term = node.title;
    const slug = sanitizeSlug(
      `${topicNumber}-${sectionCode}-${term}`.substring(0, 100)
    );

    records.push({
      section_code: sectionCode,
      section_title: term,
      subsection_code: null,
      subsection_title: null,
      slug,
      term_lt: term,
      term_en: "",
      description_lt: "",
      description_en: "",
      source_ref: "LBS_programa.md",
      metadata: {
        curriculum_required: true,
        topic_number: topicNumber,
        is_section_header: true,
      },
    });
  }

  // Recursively process subsections
  node.subsections.forEach((sub) => {
    records.push(...nodeToConceptRecords(sub, currentPath, topicNumber));
  });

  return records;
}

function main() {
  console.log("📚 Generating curriculum concept files...\n");

  const raw = readFileSync(CURRICULUM_PATH, "utf8");
  const lines = raw.split(/\r?\n/u);
  const topics = parseLines(lines);

  topics.forEach(finalizeNode);

  let totalConcepts = 0;

  topics.forEach((topic, index) => {
    const topicNumber = index + 1;
    const records = nodeToConceptRecords(topic, [], topicNumber);

    if (records.length > 0) {
      const filename = `topic_${topicNumber}_concepts.json`;
      const filepath = path.join(OUTPUT_DIR, filename);

      writeFileSync(filepath, JSON.stringify(records, null, 2), "utf8");

      console.log(
        `✅ Topic ${topicNumber}: ${topic.title}\n   Generated ${records.length} concepts → ${filename}`
      );
      totalConcepts += records.length;
    }
  });

  console.log(
    `\n🎉 Complete! Generated ${totalConcepts} total concepts across ${topics.length} topics.`
  );
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log(
    `\n💡 Next step: Run 'node content/scripts/build_seed_sql.mjs' to regenerate SQL seeds.`
  );
}

main();
