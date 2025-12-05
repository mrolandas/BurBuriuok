import {
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  existsSync,
  mkdirSync,
} from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_FILE_PATH = path.resolve(
  __dirname,
  "../../docs/static_info/LBS_concepts_master.md"
);
const RAW_CONTENT_DIR = path.resolve(__dirname, "../raw");

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/ą/g, "a")
    .replace(/č/g, "c")
    .replace(/ę/g, "e")
    .replace(/ė/g, "e")
    .replace(/į/g, "i")
    .replace(/š/g, "s")
    .replace(/ų/g, "u")
    .replace(/ū/g, "u")
    .replace(/ž/g, "z")
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

function parseMasterFile() {
  const content = readFileSync(MASTER_FILE_PATH, "utf-8");
  const lines = content.split("\n");

  const nodes = [];
  const items = [];
  const conceptsByTopic = {};

  let currentTopic = null;
  let currentSection = null;
  let currentTableHeaders = null;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Topic (Level 1)
    if (line.startsWith("## ") && !line.startsWith("### ")) {
      const titleRaw = line.replace(/^##\s+/, "").trim();
      // Extract code and title. E.g. "1. JACHTOS..." -> code: "1", title: "JACHTOS..."
      const match = titleRaw.match(/^(\d+)\.?\s+(.*)$/);
      let code, title;
      if (match) {
        code = match[1];
        title = match[2];
      } else {
        // Fallback if no number
        code = slugify(titleRaw);
        title = titleRaw;
      }

      currentTopic = {
        code,
        title,
        summary: null,
        level: 1,
        parent_code: null,
        ordinal: nodes.filter((n) => n.level === 1).length + 1,
      };
      nodes.push(currentTopic);
      currentSection = null;
      inTable = false;
      continue;
    }

    // Section (Level 2)
    if (line.startsWith("### ")) {
      const titleRaw = line.replace(/^###\s+/, "").trim();
      // Extract code and title. E.g. "1.1a Burinių..." -> code: "1.1a", title: "Burinių..."
      // Or "1.1.1 Burlaivių..." -> code: "1.1.1", title: "Burlaivių..."
      const match = titleRaw.match(/^([\d\.a-z]+)\s+(.*)$/i);
      let code, title;
      if (match) {
        code = match[1];
        title = match[2];
      } else {
        code = currentTopic
          ? `${currentTopic.code}.${
              nodes.filter((n) => n.parent_code === currentTopic.code).length +
              1
            }`
          : slugify(titleRaw);
        title = titleRaw;
      }

      // Ensure code is unique-ish or just use it.
      // If the code ends with a dot, remove it.
      if (code.endsWith(".")) code = code.slice(0, -1);

      currentSection = {
        code,
        title,
        summary: null,
        level: 2,
        parent_code: currentTopic ? currentTopic.code : null,
        ordinal:
          nodes.filter(
            (n) => n.parent_code === (currentTopic ? currentTopic.code : null)
          ).length + 1,
      };
      nodes.push(currentSection);
      inTable = false;
      continue;
    }

    // Table detection
    if (line.startsWith("|")) {
      if (!inTable) {
        // Check if it's a header row
        if (
          line.toLowerCase().includes("sąvoka lt") &&
          line.toLowerCase().includes("apibrėžimas")
        ) {
          inTable = true;
          // Parse headers to know column indices
          const headers = line
            .split("|")
            .map((h) => h.trim())
            .filter((h) => h);
          currentTableHeaders = headers.map((h) => h.toLowerCase());
          // Skip separator line
          if (
            lines[i + 1] &&
            lines[i + 1].trim().startsWith("|") &&
            lines[i + 1].includes("---")
          ) {
            i++;
          }
          continue;
        }
      } else {
        // Data row
        const cells = line.split("|").map((c) => c.trim());
        // First and last might be empty due to leading/trailing pipes
        if (cells[0] === "") cells.shift();
        if (cells[cells.length - 1] === "") cells.pop();

        if (cells.length < 2) continue; // Not enough data

        // Map cells to fields based on headers
        // Expected: Sąvoka LT | Sąvoka EN | Apibrėžimas

        let termLt = "";
        let termEn = "";
        let definition = "";

        // Simple positional mapping if headers match standard
        // Or use header index
        const ltIndex = currentTableHeaders.findIndex((h) =>
          h.includes("sąvoka lt")
        );
        const enIndex = currentTableHeaders.findIndex((h) =>
          h.includes("sąvoka en")
        );
        const defIndex = currentTableHeaders.findIndex((h) =>
          h.includes("apibrėžimas")
        );

        if (ltIndex !== -1) termLt = cells[ltIndex] || "";
        if (enIndex !== -1) termEn = cells[enIndex] || "";
        if (defIndex !== -1) definition = cells[defIndex] || "";

        if (termLt) {
          if (!currentTopic) {
            console.warn("Concept found outside of topic:", termLt);
            continue;
          }

          const topicCode = currentTopic.code;
          if (!conceptsByTopic[topicCode]) {
            conceptsByTopic[topicCode] = [];
          }

          const sectionCode = currentSection
            ? currentSection.code
            : currentTopic.code;
          const sectionTitle = currentSection
            ? currentSection.title
            : currentTopic.title;

          const slug = `${sectionCode}-${slugify(termLt)}`.replace(/\./g, "-");

          const ordinal =
            items.filter((it) => it.node_code === sectionCode).length + 1;

          const concept = {
            section_code: sectionCode,
            section_title: sectionTitle,
            subsection_code: null,
            subsection_title: null,
            slug: slug,
            term_lt: termLt,
            term_en: termEn || null,
            description_lt: definition || null,
            description_en: null,
            source_ref: "LBS_concepts_master.md",
            metadata: {
              curriculum_required: true,
              topic_number: parseInt(currentTopic.code, 10) || 0,
              parent_section: sectionTitle,
            },
            curriculum_node_code: sectionCode,
            curriculum_item_ordinal: ordinal,
            curriculum_item_label: termLt,
          };

          conceptsByTopic[topicCode].push(concept);

          // Add to items
          items.push({
            node_code: sectionCode,
            ordinal: ordinal,
            label: termLt,
          });
        }
      }
    } else {
      if (inTable && line === "") {
        inTable = false;
      }
    }
  }

  return { nodes, items, conceptsByTopic };
}

function run() {
  console.log("Parsing master file...");
  const { nodes, items, conceptsByTopic } = parseMasterFile();

  console.log(
    `Found ${nodes.length} curriculum nodes and ${items.length} items.`
  );

  // Write curriculum structure
  const structure = { nodes, items };
  writeFileSync(
    path.join(RAW_CONTENT_DIR, "curriculum_structure.json"),
    JSON.stringify(structure, null, 2)
  );
  console.log("Wrote curriculum_structure.json");

  // Clean up old concept files
  const files = readdirSync(RAW_CONTENT_DIR);
  for (const file of files) {
    if (file.endsWith("_concepts.json")) {
      unlinkSync(path.join(RAW_CONTENT_DIR, file));
    }
  }
  console.log("Removed old concept files.");

  // Write new concept files
  for (const [topicCode, concepts] of Object.entries(conceptsByTopic)) {
    const filename = `topic_${topicCode}_concepts.json`;
    writeFileSync(
      path.join(RAW_CONTENT_DIR, filename),
      JSON.stringify(concepts, null, 2)
    );
    console.log(`Wrote ${filename} (${concepts.length} concepts)`);
  }
}

run();
