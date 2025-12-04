import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.resolve(__dirname, "../content/raw");
const STRUCTURE_FILE = path.join(RAW_DIR, "curriculum_structure.json");

const structure = JSON.parse(fs.readFileSync(STRUCTURE_FILE, "utf8"));

// Map title -> code
// Handle duplicates by storing array of codes
const titleToCodes = {};
const codeToNode = {};

structure.nodes.forEach((node) => {
  if (!titleToCodes[node.title]) {
    titleToCodes[node.title] = [];
  }
  titleToCodes[node.title].push(node.code);
  codeToNode[node.code] = node;
});

const files = fs
  .readdirSync(RAW_DIR)
  .filter((f) => f.endsWith("_concepts.json"));

files.forEach((file) => {
  const filePath = path.join(RAW_DIR, file);
  const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let modified = false;

  // Heuristic for duplicates based on filename
  // topic_X_concepts.json -> starts with X.
  const filenameMatch = file.match(/topic_(\d+)_concepts\.json/);
  const topicStart = filenameMatch ? filenameMatch[1] : null;

  content.forEach((concept) => {
    // Resolve section_code
    if (concept.section_title) {
      const codes = titleToCodes[concept.section_title];
      if (codes) {
        let bestCode = codes[0];
        if (codes.length > 1 && topicStart) {
          // Try to find code starting with topicStart
          const match = codes.find((c) => c.startsWith(topicStart + "."));
          if (match) bestCode = match;
        }

        if (concept.section_code !== bestCode) {
          console.log(
            `Updating section code for "${concept.section_title}": ${concept.section_code} -> ${bestCode}`
          );
          concept.section_code = bestCode;
          modified = true;
        }
      } else {
        console.warn(
          `Warning: Section title "${concept.section_title}" not found in structure.`
        );
      }
    }

    // Resolve subsection_code
    if (concept.subsection_title) {
      const codes = titleToCodes[concept.subsection_title];
      if (codes) {
        let bestCode = codes[0];
        if (codes.length > 1 && topicStart) {
          const match = codes.find((c) => c.startsWith(topicStart + "."));
          if (match) bestCode = match;
        }
        // Also check if parent matches section_code
        if (codes.length > 1 && concept.section_code) {
          const match = codes.find((c) => {
            const node = codeToNode[c];
            return node && node.parent_code === concept.section_code;
          });
          if (match) bestCode = match;
        }

        if (concept.subsection_code !== bestCode) {
          console.log(
            `Updating subsection code for "${concept.subsection_title}": ${concept.subsection_code} -> ${bestCode}`
          );
          concept.subsection_code = bestCode;
          modified = true;
        }
      } else {
        console.warn(
          `Warning: Subsection title "${concept.subsection_title}" not found in structure.`
        );
      }
    }

    // Update curriculum_node_code
    let newNodeCode = null;
    if (concept.subsection_code) newNodeCode = concept.subsection_code;
    else if (concept.section_code) newNodeCode = concept.section_code;

    if (newNodeCode && concept.curriculum_node_code !== newNodeCode) {
      // console.log(`Updating node code: ${concept.curriculum_node_code} -> ${newNodeCode}`);
      concept.curriculum_node_code = newNodeCode;
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    console.log(`Updated ${file}`);
  }
});
