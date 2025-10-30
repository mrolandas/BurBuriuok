#!/usr/bin/env node

// Extracts glossary concepts from the legacy first_draft prototype HTML and
// stores them as structured JSON files under content/raw/.
// Usage: `node content/scripts/extract_prototype_content.mjs`

import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "fs";
import path from "path";
import { parse } from "node-html-parser";

const RAW_DIR = path.resolve(new URL("../raw", import.meta.url).pathname);
const PROTOTYPE_PATH = path.resolve(
  new URL("../../first_draft/index.html", import.meta.url).pathname
);

function ensureRawDir() {
  mkdirSync(RAW_DIR, { recursive: true });
}

function cleanExistingSectionFiles() {
  const files = readdirSync(RAW_DIR, { withFileTypes: true });
  for (const file of files) {
    if (
      file.isFile() &&
      /^section_[a-z0-9_]+_concepts\.json$/i.test(file.name)
    ) {
      rmSync(path.join(RAW_DIR, file.name));
    }
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[&\/]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSubsection(rawTitle) {
  if (!rawTitle) {
    return { code: null, title: null };
  }
  const trimmed = rawTitle.trim().replace(/\s+/g, " ");
  const match = trimmed.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
  if (match) {
    return { code: match[1], title: match[2].trim() };
  }
  return { code: null, title: trimmed };
}

function extractConcepts() {
  const html = readFileSync(PROTOTYPE_PATH, "utf8");
  const root = parse(html);

  const sections = root.querySelectorAll(".section");
  const sectionsMap = new Map(); // key -> { meta, items[] }
  const usedSlugs = new Set();

  for (const section of sections) {
    const sectionCode =
      section
        .querySelector(".section-number")
        ?.text?.trim()
        ?.replace(/\s+/g, " ") || null;
    const sectionTitle =
      section
        .querySelector(".section-title")
        ?.text?.trim()
        ?.replace(/\s+/g, " ") || null;

    const sectionKey = (sectionCode || sectionTitle || "section")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "");

    if (!sectionsMap.has(sectionKey)) {
      sectionsMap.set(sectionKey, {
        sectionCode,
        sectionTitle,
        items: [],
      });
    }

    const subsections = section.querySelectorAll(".subsection");
    for (const subsection of subsections) {
      const subsectionTitleNode = subsection.querySelector(".subsection-title");
      const { code: subsectionCode, title: subsectionTitle } =
        normalizeSubsection(subsectionTitleNode?.text);

      const termItems = subsection.querySelectorAll(".term-item");
      for (const term of termItems) {
        const termName = term
          .querySelector(".term-name")
          ?.text?.trim()
          ?.replace(/\s+/g, " ");
        const termEnglish = term
          .querySelector(".term-english")
          ?.text?.trim()
          ?.replace(/\s+/g, " ");
        const desc = term.getAttribute("data-desc")?.trim() || null;
        const baseName = term.getAttribute("data-term")?.trim();

        const resolvedTerm = termName || baseName;
        if (!resolvedTerm) {
          continue;
        }

        const baseSlug = slugify(resolvedTerm);
        if (!baseSlug) {
          throw new Error(`Unable to derive slug for term '${resolvedTerm}'`);
        }

        let slug = baseSlug;
        let attempt = 2;
        while (usedSlugs.has(slug)) {
          slug = `${baseSlug}-${attempt}`;
          attempt += 1;
        }
        usedSlugs.add(slug);

        sectionsMap.get(sectionKey).items.push({
          section_code: sectionCode,
          section_title: sectionTitle,
          subsection_code: subsectionCode,
          subsection_title: subsectionTitle,
          slug,
          term_lt: termName || resolvedTerm,
          term_en: termEnglish || null,
          description_lt: desc,
          description_en: null,
          source_ref: sectionCode ? `LBS ${sectionCode}` : null,
        });
      }
    }
  }

  return sectionsMap;
}

function validateUniqueness(sectionsMap) {
  const slugs = new Set();
  for (const { items } of sectionsMap.values()) {
    for (const item of items) {
      if (slugs.has(item.slug)) {
        throw new Error(`Duplicate slug detected: ${item.slug}`);
      }
      slugs.add(item.slug);
    }
  }
  return slugs.size;
}

function writeSectionFiles(sectionsMap) {
  let total = 0;
  for (const [key, data] of sectionsMap.entries()) {
    if (!data.items.length) {
      continue;
    }
    const filename = `section_${key || "general"}_concepts.json`;
    const filePath = path.join(RAW_DIR, filename);
    const sortedItems = data.items;
    total += sortedItems.length;
    writeFileSync(
      filePath,
      JSON.stringify(sortedItems, null, 2) + "\n",
      "utf8"
    );
  }
  return total;
}

function main() {
  ensureRawDir();
  cleanExistingSectionFiles();
  const sectionsMap = extractConcepts();
  const count = validateUniqueness(sectionsMap);
  const totalWritten = writeSectionFiles(sectionsMap);
  console.log(
    `Extracted ${totalWritten} concepts across ${sectionsMap.size} sections (unique slugs: ${count}).`
  );
}

main();
