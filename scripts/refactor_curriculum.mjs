import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.resolve(__dirname, "../content/raw");
const STRUCTURE_FILE = path.join(RAW_DIR, "curriculum_structure.json");

const structure = JSON.parse(fs.readFileSync(STRUCTURE_FILE, "utf8"));

const remapping = new Map();

// Helper to generate clean codes
function generateCode(parentCode, ordinal) {
  if (!parentCode) return `${ordinal}`;
  return `${parentCode}.${ordinal}`;
}

// Sort nodes by level and ordinal to ensure we process parents first
structure.nodes.sort((a, b) => {
  if (a.level !== b.level) return a.level - b.level;
  // If same level, group by parent
  if (a.parent_code !== b.parent_code) {
    return (a.parent_code || "").localeCompare(b.parent_code || "");
  }
  return a.ordinal - b.ordinal;
});

// First pass: Identify remappings
// We need to rebuild the tree to assign new ordinals correctly
const tree = {}; // parentCode -> list of children

structure.nodes.forEach((node) => {
  const parent = node.parent_code || "root";
  if (!tree[parent]) tree[parent] = [];
  tree[parent].push(node);
});

// Sort children by ordinal
Object.values(tree).forEach((children) => {
  children.sort((a, b) => a.ordinal - b.ordinal);
});

// Recursive function to assign new codes
function assignNewCodes(parentOldCode, parentNewCode) {
  const children = tree[parentOldCode] || [];
  children.forEach((child, index) => {
    const newOrdinal = index + 1;
    const newCode = generateCode(parentNewCode, newOrdinal);

    if (child.code !== newCode) {
      remapping.set(child.code, newCode);
      console.log(`Remapping ${child.code} -> ${newCode} (${child.title})`);
    }

    // Recurse
    assignNewCodes(child.code, newCode);
  });
}

assignNewCodes("root", null);

// Apply remappings to structure
structure.nodes.forEach((node) => {
  if (remapping.has(node.code)) {
    node.code = remapping.get(node.code);
  }
  if (node.parent_code && remapping.has(node.parent_code)) {
    node.parent_code = remapping.get(node.parent_code);
  }
});

// Write back structure
fs.writeFileSync(STRUCTURE_FILE, JSON.stringify(structure, null, 2));

// Apply remappings to all concept files
const files = fs
  .readdirSync(RAW_DIR)
  .filter((f) => f.endsWith("_concepts.json"));

files.forEach((file) => {
  const filePath = path.join(RAW_DIR, file);
  const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let modified = false;

  content.forEach((concept) => {
    // Remap section_code
    if (concept.section_code && remapping.has(concept.section_code)) {
      concept.section_code = remapping.get(concept.section_code);
      modified = true;
    }
    // Remap subsection_code
    if (concept.subsection_code && remapping.has(concept.subsection_code)) {
      concept.subsection_code = remapping.get(concept.subsection_code);
      modified = true;
    }
    // Remap curriculum_node_code (if it exists in raw, though usually it's derived)
    if (
      concept.curriculum_node_code &&
      remapping.has(concept.curriculum_node_code)
    ) {
      concept.curriculum_node_code = remapping.get(
        concept.curriculum_node_code
      );
      modified = true;
    }
  });

  if (modified) {
    console.log(`Updating ${file}`);
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
  }
});

console.log("Refactor complete.");
