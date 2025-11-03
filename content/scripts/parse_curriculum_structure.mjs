import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DOC_PATH = path.resolve(
  __dirname,
  "../..",
  "docs/static_info/LBS_programa.md"
);

const DEFAULT_OUTPUT_PATH = path.resolve(
  __dirname,
  "../..",
  "docs/static_info/temp_structure_interpretation.md"
);

const DEFAULT_JSON_OUTPUT_PATH = path.resolve(
  __dirname,
  "../raw/curriculum_structure.json"
);

function parseLines(lines) {
  const topics = [];
  const stack = [];
  let lastNode = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }

    const numberedMatch = rawLine.match(
      /^\s*(\d+(?:\.\d+)*)(\.)?(?:\s+(.*))?$/u
    );

    if (numberedMatch) {
      const baseNumber = numberedMatch[1];
      const hasTrailingDot = Boolean(numberedMatch[2]);
      const remainder = numberedMatch[3] ?? "";

      const numberSegments = baseNumber.split(".").filter(Boolean);
      const topOfStack = stack[stack.length - 1];
      const duplicateWithParent =
        hasTrailingDot && topOfStack && topOfStack.numberKey === baseNumber;

      let level = numberSegments.length || 1;
      if (duplicateWithParent && topOfStack) {
        level = topOfStack.level + 1;
      }

      const node = {
        numberRaw: `${baseNumber}${hasTrailingDot ? "." : ""}`,
        numberKey: baseNumber,
        level,
        rawText: remainder.trim(),
        title: "",
        summary: "",
        items: [],
        subsections: [],
        ordinal: 0,
        hasTrailingDot,
        duplicateWithParent,
      };

      while (stack.length >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        node.ordinal = topics.length + 1;
        topics.push(node);
      } else {
        const parent = stack[stack.length - 1];
        node.ordinal = parent.subsections.length + 1;
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
    node.summary = "";
  } else {
    const colonIndex = text.indexOf(":");
    const hasItems = colonIndex !== -1 && colonIndex < text.length - 1;

    if (hasItems && node.subsections.length === 0) {
      node.title = text.slice(0, colonIndex).replace(/\.+$/u, "").trim();

      const itemsText = text.slice(colonIndex + 1).trim();
      node.items = splitItemsPreservingParentheses(itemsText);
      node.summary = "";
    } else {
      if (colonIndex !== -1) {
        node.title = text.slice(0, colonIndex).replace(/\.+$/u, "").trim();
        node.summary = text.slice(colonIndex + 1).trim();
      } else {
        node.title = text.replace(/\.+$/u, "").trim();
        node.summary = "";
      }
    }
  }

  node.subsections.forEach(finalizeNode);
}

function cleanEmptyTitles(node) {
  if (!node.title) {
    node.title = "(untitled)";
  }

  node.subsections.forEach(cleanEmptyTitles);
}

function markdownForNode(node, depth = 0) {
  const lines = [];
  const indent = "  ".repeat(depth);
  const bullet = `${indent}- ${node.numberRaw.replace(/\.$/u, "")} — ${
    node.title
  }`;
  lines.push(bullet);

  if (node.summary) {
    lines.push(`${indent}  - summary: ${node.summary}`);
  }

  if (node.items.length) {
    lines.push(
      `${indent}  - items (${node.items.length}): ${node.items.join(", ")}`
    );
  }

  if (node.subsections.length) {
    lines.push(`${indent}  - nested subsections (${node.subsections.length}):`);
    node.subsections.forEach((child) => {
      lines.push(...markdownForNode(child, depth + 2));
    });
  }

  return lines;
}

function collectStats(topics) {
  const stats = {
    level2: 0,
    level3Plus: 0,
    items: 0,
  };

  function walk(node) {
    if (node.level === 2) {
      stats.level2 += 1;
    } else if (node.level >= 3) {
      stats.level3Plus += 1;
    }

    stats.items += node.items.length;
    node.subsections.forEach(walk);
  }

  topics.forEach((topic) => {
    stats.items += topic.items.length;
    topic.subsections.forEach(walk);
  });

  return stats;
}

function buildMarkdown(topics) {
  let markdown = "# LBS_programa.md — Structure interpretation\n\n";
  markdown += `Total top-level topics found: ${topics.length} \n\n`;

  topics.forEach((topic) => {
    const subsectionCount = topic.subsections.length;
    markdown += `## Topic ${topic.numberRaw.replace(/\.$/u, "")} — ${
      topic.title
    }\n\n`;
    markdown += `Subsections (${subsectionCount}):\n\n`;

    topic.subsections.forEach((subsection) => {
      markdown += `${markdownForNode(subsection).join("\n")}\n\n`;
    });

    markdown += "\n";
  });

  const stats = collectStats(topics);

  markdown += "---\n\n";
  markdown += "Statistics:\n\n";
  markdown += `- Total topics (top-level): ${topics.length}\n`;
  markdown += `- Total topic subsections (2nd level): ${stats.level2}\n`;
  markdown += `- Total nested subsections (3rd level and deeper): ${stats.level3Plus}\n`;
  markdown += `- Total explicitly listed items captured (comma-separated lists): ${stats.items}\n\n`;

  return markdown;
}

function alphabeticSuffix(index) {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let value = "";
  let current = index;
  while (current > 0) {
    current -= 1;
    value = letters[current % 26] + value;
    current = Math.floor(current / 26);
  }
  return value;
}

function buildNodeCode(node) {
  if (node.duplicateWithParent) {
    return `${node.numberKey}${alphabeticSuffix(node.ordinal)}`;
  }
  return node.numberRaw.replace(/\.$/u, "");
}

function flattenStructure(topics) {
  const nodes = [];
  const items = [];

  function walk(node, parentCode = null) {
    const code = buildNodeCode(node);
    nodes.push({
      code,
      title: node.title,
      summary: node.summary || null,
      level: node.level,
      parent_code: parentCode,
      ordinal: node.ordinal,
    });

    node.items.forEach((label, index) => {
      items.push({
        node_code: code,
        ordinal: index + 1,
        label: label.trim().replace(/[\s\u00A0]+$/u, ""),
      });
    });

    node.subsections.forEach((child) => walk(child, code));
  }

  topics.forEach((topic) => walk(topic, null));

  return { nodes, items };
}

function main() {
  const docPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : DEFAULT_DOC_PATH;
  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : DEFAULT_OUTPUT_PATH;
  const jsonOutputPath = DEFAULT_JSON_OUTPUT_PATH;

  const raw = readFileSync(docPath, "utf8");
  const lines = raw.split(/\r?\n/u);
  const topics = parseLines(lines);

  topics.forEach(finalizeNode);
  topics.forEach(cleanEmptyTitles);

  const markdown = buildMarkdown(topics);
  writeFileSync(outputPath, `${markdown.trim()}\n`, "utf8");

  const structure = flattenStructure(topics);
  writeFileSync(
    jsonOutputPath,
    `${JSON.stringify(structure, null, 2)}\n`,
    "utf8"
  );
  console.log(
    `Wrote interpretation markdown to ${outputPath} and structure JSON to ${jsonOutputPath}`
  );
}

main();
