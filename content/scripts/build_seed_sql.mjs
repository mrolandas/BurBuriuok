#!/usr/bin/env node

// Generates Supabase seed SQL from raw concept JSON data.
// Usage: `node content/scripts/build_seed_sql.mjs`

import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

import {
  applyCurriculumRequirements,
  normalizeCurriculumString,
} from "./lib/curriculum.mjs";

let z;
try {
  ({ z } = await import("zod"));
} catch (error) {
  console.error(
    "Missing dependency 'zod'. Install it locally with `npm install zod` before running this script."
  );
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAW_DIR = path.resolve(__dirname, "../raw");
const OUTPUT_FILE = path.resolve(
  __dirname,
  "../../supabase/seeds/seed_concepts.sql"
);
const STRUCTURE_PATH = path.resolve(
  __dirname,
  "../raw/curriculum_structure.json"
);
const MASTER_CONCEPT_PATH = path.resolve(
  __dirname,
  "../../docs/static_info/LBS_concepts_master.md"
);

function parseCliArgs(rawArgs) {
  const options = {
    checkOnly: false,
    outputFile: OUTPUT_FILE,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--check") {
      options.checkOnly = true;
      continue;
    }
    if (arg === "--out") {
      const candidate = rawArgs[index + 1];
      if (!candidate) {
        console.error("Expected a file path after --out.");
        process.exit(1);
      }
      options.outputFile = path.resolve(process.cwd(), candidate);
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        `Usage: node content/scripts/build_seed_sql.mjs [--check] [--out <path>]`
      );
      console.log(
        "--check    Generate SQL in-memory and verify it matches the existing output file."
      );
      console.log(
        "--out      Write or compare against a different output path (default supabase/seeds/seed_concepts.sql)."
      );
      process.exit(0);
    }
    console.error(`Unknown argument '${arg}'. Use --help to view options.`);
    process.exit(1);
  }

  return options;
}

const cliOptions = parseCliArgs(process.argv.slice(2));

const MANUAL_ITEM_OVERRIDES = new Map(
  [
    ["zalingiai sprederiai", { nodeCode: "1.2.2", ordinal: 1 }],
    ["grotstiebis", { nodeCode: "1.2.2", ordinal: 6 }],
    ["forstiebis", { nodeCode: "1.2.2", ordinal: 6 }],
    ["bizanstiebis", { nodeCode: "1.2.2", ordinal: 6 }],
    ["kampai", { nodeCode: "1.2.4", ordinal: 13 }],
    ["krastines", { nodeCode: "1.2.4", ordinal: 13 }],
    ["denforto inkaras", { nodeCode: "1.3.1", ordinal: 12 }],
    ["pluginis inkaras", { nodeCode: "1.3.1", ordinal: 12 }],
    ["sudedamasis inkaras", { nodeCode: "1.3.1", ordinal: 12 }],
    ["grybo inkaras", { nodeCode: "1.3.1", ordinal: 12 }],
    ["sraigtinis inkaras", { nodeCode: "1.3.1", ordinal: 12 }],
    ["delta inkaras", { nodeCode: "1.3.1", ordinal: 12 }],
    ["dyzeliniai varikliai", { nodeCode: "1.3.3", ordinal: 1 }],
    ["benzininiai varikliai", { nodeCode: "1.3.3", ordinal: 1 }],
    ["elektriniai varikliai", { nodeCode: "1.3.3", ordinal: 1 }],
    ["markonine bermudine bure", { nodeCode: "1.2.4", ordinal: 4 }],
    ["dzonko bure", { nodeCode: "1.2.4", ordinal: 8 }],
    ["bermudinio groto kampai krastines", { nodeCode: "1.2.4", ordinal: 13 }],
    ["inkaru tipai", { nodeCode: "1.3.1", ordinal: 12 }],
    ["sanitarines priemones", { nodeCode: "1.3.2", ordinal: 8 }],
    ["varikliu rusys ir paruosimas", { nodeCode: "1.3.3", ordinal: 1 }],
    ["vandens telkinio dugno gruntas", { nodeCode: "3.12.1", ordinal: 1 }],
    ["povandeniniai kliuviniai", { nodeCode: "3.12.1", ordinal: 2 }],
    ["meteorologiniai aspektai", { nodeCode: "3.12.1", ordinal: 5 }],
    ["hidrologiniai aspektai", { nodeCode: "3.12.1", ordinal: 6 }],
    ["teisiniai aspektai", { nodeCode: "3.12.1", ordinal: 7 }],
    ["urbanistiniai aspektai", { nodeCode: "3.12.1", ordinal: 8 }],
    ["vejo matuokliai", { nodeCode: "6.16", ordinal: 3 }],
    ["garsiniai signalai", { nodeCode: "8.8", ordinal: 1 }],
    ["velkantis laivas", { nodeCode: "9.3", ordinal: 4 }],
    ["minu traluotojas", { nodeCode: "9.3", ordinal: 10 }],
  ].map(([key, value]) => [normalizeCurriculumString(key), value])
);

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[&/]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sanitizeHeadingTitle(rawTitle) {
  if (!rawTitle) {
    return null;
  }
  return rawTitle.trim().replace(/\s*\([^)]*\)\s*$/, "");
}

function extractTopLevelCode(code) {
  if (!code) {
    return null;
  }
  const [first] = String(code).split(".");
  return first ? first.replace(/\D/g, "") || first : null;
}

function toNullable(value) {
  const trimmed = typeof value === "string" ? value.trim() : value;
  if (trimmed === undefined || trimmed === null) {
    return null;
  }
  return trimmed === "" ? null : trimmed;
}

function parseTableRow(line) {
  if (!line || !line.trim().startsWith("|")) {
    return null;
  }
  const parts = line.trim().split("|");
  if (!parts.length) {
    return null;
  }
  const cells = parts.slice(
    1,
    parts[parts.length - 1].trim() === "" ? -1 : undefined
  );
  return cells.map((cell) => cell.trim());
}

function resolveSectionFields(currentSection, currentTopLevel, nodesByCode) {
  if (!currentSection) {
    const topNode = currentTopLevel?.node ?? null;
    return {
      section_code: currentTopLevel?.code ?? null,
      section_title: topNode?.title ?? currentTopLevel?.title ?? null,
      subsection_code: null,
      subsection_title: null,
      metadataParentTitle: topNode?.title ?? currentTopLevel?.title ?? null,
    };
  }

  const node = currentSection.node;
  const parentNode = node?.parent_code
    ? nodesByCode.get(String(node.parent_code))
    : null;
  const preferParent = Boolean(parentNode);

  if (preferParent) {
    return {
      section_code: parentNode.code,
      section_title: parentNode.title ?? currentSection.parentTitle ?? null,
      subsection_code: node?.code ?? null,
      subsection_title: currentSection.title ?? node?.title ?? null,
      metadataParentTitle: node?.title ?? currentSection.title ?? null,
    };
  }

  return {
    section_code: node?.code ?? currentSection.code ?? null,
    section_title: currentSection.title ?? node?.title ?? null,
    subsection_code: null,
    subsection_title: null,
    metadataParentTitle: currentSection.title ?? node?.title ?? null,
  };
}

function loadConceptRecordsFromMaster(structure) {
  if (!structure || !structure.nodes || !structure.nodes.length) {
    throw new Error(
      "Curriculum structure is required to ingest the master concept document."
    );
  }

  const nodesByCode = new Map(
    structure.nodes.map((node) => [String(node.code), { ...node }])
  );

  const markdown = readFileSync(MASTER_CONCEPT_PATH, "utf8");
  const lines = markdown.split(/\r?\n/);

  const records = [];
  const usedSlugs = new Set();

  let currentTopLevel = null;
  let currentSection = null;
  let tableBuffer = [];

  const sourceRef = path.basename(MASTER_CONCEPT_PATH);

  const flushTable = () => {
    if (!tableBuffer.length || !currentTopLevel) {
      tableBuffer = [];
      return;
    }

    const headerCells = parseTableRow(tableBuffer[0]) ?? [];
    if (!headerCells.length) {
      tableBuffer = [];
      return;
    }

    const normalizedHeaders = headerCells.map((cell) =>
      cell.toLowerCase().replace(/\s+/g, " ").trim()
    );
    const matchesAnyHeader = (cell, candidates) =>
      candidates.some(
        (candidate) => cell === candidate || cell.startsWith(`${candidate} `)
      );

    const termLtIndex = normalizedHeaders.findIndex((cell) =>
      matchesAnyHeader(cell, ["term lt", "sąvoka lt", "savoka lt"])
    );
    const termEnIndex = normalizedHeaders.findIndex((cell) =>
      matchesAnyHeader(cell, ["term en", "sąvoka en", "savoka en"])
    );
    const definitionIndex = normalizedHeaders.findIndex(
      (cell) => cell.includes("apibr") || cell.includes("apras")
    );

    if (termLtIndex === -1) {
      tableBuffer = [];
      return;
    }

    for (let rowIndex = 1; rowIndex < tableBuffer.length; rowIndex += 1) {
      const line = tableBuffer[rowIndex];
      if (/^\|\s*[-:]+/.test(line)) {
        continue;
      }
      const cells = parseTableRow(line);
      if (!cells || !cells.length) {
        continue;
      }
      const termLt = toNullable(cells[termLtIndex]);
      if (!termLt) {
        continue;
      }
      const termEn = termEnIndex >= 0 ? toNullable(cells[termEnIndex]) : null;
      const descriptionLt =
        definitionIndex >= 0 ? toNullable(cells[definitionIndex]) : null;

      const baseSlug = slugify(termLt) || slugify(`${termLt}-${rowIndex}`);
      let slug = baseSlug || `concept-${records.length + 1}`;
      let counter = 2;
      while (usedSlugs.has(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter += 1;
      }
      usedSlugs.add(slug);

      const sectionFields = resolveSectionFields(
        currentSection,
        currentTopLevel,
        nodesByCode
      );

      const topicCode = extractTopLevelCode(
        currentSection?.code ??
          sectionFields.section_code ??
          currentTopLevel.code
      );
      const topicNumber = topicCode ? Number.parseInt(topicCode, 10) : NaN;

      const metadata = {};
      if (!Number.isNaN(topicNumber)) {
        metadata.topic_number = topicNumber;
      }
      if (sectionFields.metadataParentTitle) {
        metadata.parent_section = sectionFields.metadataParentTitle;
      }

      const record = {
        section_code: sectionFields.section_code ?? null,
        section_title: sectionFields.section_title ?? null,
        subsection_code: sectionFields.subsection_code ?? null,
        subsection_title: sectionFields.subsection_title ?? null,
        slug,
        term_lt: termLt,
        term_en: termEn,
        description_lt: descriptionLt,
        description_en: null,
        source_ref: sourceRef,
      };

      if (Object.keys(metadata).length) {
        record.metadata = metadata;
      }

      records.push(record);
    }

    tableBuffer = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushTable();
      return;
    }

    if (line.startsWith("## ") && !line.startsWith("###")) {
      flushTable();
      const match = line.match(/^##\s+([^\s]+)\s+(.*)$/);
      if (match) {
        const rawCode = match[1].replace(/\.$/, "");
        const title = sanitizeHeadingTitle(match[2]);
        const node = nodesByCode.get(rawCode) ?? null;
        currentTopLevel = {
          code: rawCode,
          title,
          node,
        };
        currentSection = null;
      }
      return;
    }

    if (line.startsWith("### ")) {
      flushTable();
      const match = line.match(/^###\s+([^\s]+)\s+(.*)$/);
      if (match) {
        const rawCode = match[1].replace(/\.$/, "");
        const title = sanitizeHeadingTitle(match[2]);
        const node = nodesByCode.get(rawCode) ?? null;
        const parentTitle = node?.parent_code
          ? nodesByCode.get(String(node.parent_code))?.title ?? null
          : null;
        currentSection = {
          code: rawCode,
          title,
          node,
          parentTitle,
        };
        if (!currentTopLevel) {
          const inferredTopLevel = extractTopLevelCode(rawCode);
          if (inferredTopLevel) {
            const inferredNode = nodesByCode.get(inferredTopLevel) ?? null;
            currentTopLevel = {
              code: inferredTopLevel,
              title: inferredNode?.title ?? null,
              node: inferredNode,
            };
          }
        }
      }
      return;
    }

    if (line.startsWith("|")) {
      tableBuffer.push(rawLine);
      return;
    }

    if (line.startsWith("---")) {
      flushTable();
      return;
    }

    flushTable();
  });

  flushTable();

  const dedupedRecords = deduplicateConceptRecords(records);

  if (!dedupedRecords.length) {
    throw new Error(
      `Master concept document at ${MASTER_CONCEPT_PATH} did not yield any records.`
    );
  }

  const byTopic = new Map();
  dedupedRecords.forEach((record) => {
    const topic =
      record.metadata?.topic_number ?? extractTopLevelCode(record.section_code);
    if (!topic) {
      return;
    }
    const key = String(topic);
    byTopic.set(key, (byTopic.get(key) ?? 0) + 1);
  });

  return {
    records: conceptSchema.array().parse(dedupedRecords),
    summary: {
      source: "master_markdown",
      total: dedupedRecords.length,
      topics: Object.fromEntries(Array.from(byTopic.entries()).sort()),
    },
  };
}

function escapeLiteral(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function formatBoolean(value) {
  return value ? "true" : "false";
}

function formatInteger(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    throw new Error(`Unable to format integer value: ${value}`);
  }
  return String(Math.trunc(numeric));
}

function deduplicateConceptRecords(records) {
  const deduped = [];
  const indexByKey = new Map();

  const buildKey = (record) =>
    `${record.section_code}::${record.term_lt.trim().toLowerCase()}`;

  records.forEach((record) => {
    const key = buildKey(record);
    if (!indexByKey.has(key)) {
      indexByKey.set(key, deduped.length);
      deduped.push(record);
      return;
    }

    const existingIndex = indexByKey.get(key);
    const existing = deduped[existingIndex];
    const existingDescriptionLength = existing?.description_lt?.length ?? 0;
    const candidateDescriptionLength = record.description_lt?.length ?? 0;

    if (candidateDescriptionLength > existingDescriptionLength) {
      deduped[existingIndex] = record;
    }

    console.warn(
      `Duplicate concept detected for section ${record.section_code} term "${record.term_lt}". Keeping entry with the richer description.`
    );
  });

  return deduped;
}

const conceptSchema = z.object({
  section_code: z.string().min(1),
  section_title: z.string().min(1).nullable().optional(),
  subsection_code: z.string().min(1).nullable().optional(),
  subsection_title: z.string().min(1).nullable().optional(),
  slug: z.string().min(1),
  term_lt: z.string().min(1),
  term_en: z.string().min(1).nullable().optional(),
  description_lt: z.string().min(1).nullable().optional(),
  description_en: z.string().min(1).nullable().optional(),
  source_ref: z.string().min(1).nullable().optional(),
  is_required: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

function loadConceptRecordsFromRaw() {
  const files = readdirSync(RAW_DIR)
    .filter((file) => /^(section|topic)_[a-z0-9_]+_concepts\.json$/i.test(file))
    .sort();

  if (!files.length) {
    throw new Error(
      `No section concept files found in ${RAW_DIR}. Run extract_prototype_content.mjs first.`
    );
  }

  const combined = [];
  for (const file of files) {
    const absolutePath = path.join(RAW_DIR, file);
    const rawContent = readFileSync(absolutePath, "utf8");
    const parsed = conceptSchema.array().parse(JSON.parse(rawContent));
    combined.push(...parsed);
  }

  const slugSet = new Set();
  combined.forEach((record) => {
    if (slugSet.has(record.slug)) {
      throw new Error(`Duplicate slug detected: ${record.slug}`);
    }
    slugSet.add(record.slug);
  });

  return combined;
}

function loadConceptRecords(structure) {
  // if (existsSync(MASTER_CONCEPT_PATH)) {
  //   return loadConceptRecordsFromMaster(structure);
  // }

  const records = loadConceptRecordsFromRaw();
  return {
    records,
    summary: {
      source: "legacy_raw",
      total: records.length,
    },
  };
}

function loadCurriculumStructure() {
  const raw = readFileSync(STRUCTURE_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(
      `Unexpected curriculum structure content: ${typeof parsed}`
    );
  }
  if (!Array.isArray(parsed.nodes) || !parsed.nodes.length) {
    throw new Error(
      "Curriculum structure must include a non-empty 'nodes' array."
    );
  }
  if (!Array.isArray(parsed.items)) {
    throw new Error("Curriculum structure must include an 'items' array.");
  }
  return parsed;
}

function buildStructureIndexes(structure) {
  const nodesByCode = new Map();
  const nodesByTitle = new Map();

  structure.nodes.forEach((node) => {
    const normalizedTitle = normalizeCurriculumString(node.title);
    const decorated = {
      ...node,
      topLevel: String(node.code).split(".")[0],
    };
    nodesByCode.set(node.code, decorated);
    if (!nodesByTitle.has(normalizedTitle)) {
      nodesByTitle.set(normalizedTitle, []);
    }
    nodesByTitle.get(normalizedTitle).push(decorated);
  });

  const itemsByLabel = new Map();
  const itemsByNode = new Map();
  const itemsByTopLevel = new Map();
  structure.items.forEach((item) => {
    const normalizedLabel = normalizeCurriculumString(item.label ?? "");
    if (!normalizedLabel) {
      return;
    }
    const owningNode = nodesByCode.get(item.node_code);
    const entry = {
      ...item,
      node: owningNode,
      topLevel: owningNode
        ? owningNode.topLevel
        : String(item.node_code).split(".")[0],
      normalizedLabel,
    };
    if (!itemsByLabel.has(normalizedLabel)) {
      itemsByLabel.set(normalizedLabel, []);
    }
    itemsByLabel.get(normalizedLabel).push(entry);
    if (!itemsByNode.has(item.node_code)) {
      itemsByNode.set(item.node_code, []);
    }
    itemsByNode.get(item.node_code).push(entry);
    if (!itemsByTopLevel.has(entry.topLevel)) {
      itemsByTopLevel.set(entry.topLevel, []);
    }
    itemsByTopLevel.get(entry.topLevel).push(entry);
  });

  return {
    nodesByCode,
    nodesByTitle,
    itemsByLabel,
    itemsByNode,
    itemsByTopLevel,
  };
}

function resolveTopLevelCode(record) {
  const fromMetadata = record.metadata?.topic_number;
  if (fromMetadata) {
    return String(fromMetadata);
  }
  if (record.section_code) {
    return String(record.section_code).split(".")[0];
  }
  return null;
}

function pickNodeByTitle(title, topLevelCode, indexes) {
  if (!title) {
    return null;
  }
  const normalized = normalizeCurriculumString(title);
  if (!normalized) {
    return null;
  }
  const candidates = indexes.nodesByTitle.get(normalized) ?? [];
  if (!candidates.length) {
    return null;
  }

  if (topLevelCode) {
    const filtered = candidates.filter(
      (candidate) => candidate.topLevel === String(topLevelCode)
    );
    if (filtered.length === 1) {
      return filtered[0];
    }
    if (filtered.length) {
      return filtered[0];
    }
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  throw new Error(
    `Ambiguous curriculum node title '${title}' matched ${candidates.length} nodes.`
  );
}

function gatherFallbackCandidates(parentNode, topLevelCode, indexes) {
  const collected = [];
  const seen = new Set();

  const addCandidates = (list = []) => {
    list.forEach((candidate) => {
      const key = `${candidate.node_code}:${candidate.ordinal}`;
      if (!seen.has(key)) {
        seen.add(key);
        collected.push(candidate);
      }
    });
  };

  if (parentNode) {
    addCandidates(indexes.itemsByNode.get(parentNode.code) ?? []);
  }

  if (!collected.length && topLevelCode) {
    addCandidates(indexes.itemsByTopLevel.get(String(topLevelCode)) ?? []);
  }

  if (!collected.length) {
    indexes.itemsByLabel.forEach((list) => addCandidates(list));
  }

  return collected;
}

function findTokenItemMatch(normalizedTerm, candidates) {
  const tokens = normalizedTerm.split(" ").filter(Boolean);
  if (!tokens.length || !candidates.length) {
    return null;
  }

  let best = null;
  let bestLength = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    if (!candidate.normalizedLabel) {
      return;
    }
    const matchesTokens = tokens.every((token) =>
      candidate.normalizedLabel.includes(token)
    );
    if (!matchesTokens) {
      return;
    }
    const length = candidate.normalizedLabel.length;
    if (length < bestLength) {
      bestLength = length;
      best = candidate;
    }
  });

  return best;
}

function matchCurriculumItem(record, indexes, parentNode) {
  const normalizedTerm = normalizeCurriculumString(record.term_lt ?? "");
  if (!normalizedTerm) {
    return null;
  }
  const topLevel = resolveTopLevelCode(record);
  const override = normalizedTerm
    ? MANUAL_ITEM_OVERRIDES.get(normalizedTerm)
    : null;
  if (override) {
    const candidates = indexes.itemsByNode.get(override.nodeCode) ?? [];
    const item = candidates.find(
      (candidate) => candidate.ordinal === override.ordinal
    );
    if (!item) {
      throw new Error(
        `Manual curriculum override for term '${record.term_lt}' references missing node ${override.nodeCode} ordinal ${override.ordinal}.`
      );
    }
    return item;
  }
  const candidates = indexes.itemsByLabel.get(normalizedTerm) ?? [];
  if (!candidates.length) {
    const fallbackCandidates = gatherFallbackCandidates(
      parentNode,
      topLevel,
      indexes
    );
    if (!fallbackCandidates.length) {
      return null;
    }

    const tokenCandidate = findTokenItemMatch(
      normalizedTerm,
      fallbackCandidates
    );
    if (tokenCandidate) {
      return tokenCandidate;
    }

    const fuzzyCandidate = findClosestItemMatch(
      normalizedTerm,
      fallbackCandidates
    );
    if (fuzzyCandidate) {
      return fuzzyCandidate;
    }

    return findSubstringItemMatch(normalizedTerm, fallbackCandidates);
  }

  if (parentNode) {
    const scoped = candidates.filter(
      (candidate) => candidate.node_code === parentNode.code
    );
    if (scoped.length === 1) {
      return scoped[0];
    }
    if (scoped.length) {
      return scoped[0];
    }
  }

  if (topLevel) {
    const scoped = candidates.filter(
      (candidate) => candidate.topLevel === String(topLevel)
    );
    if (scoped.length === 1) {
      return scoped[0];
    }
    if (scoped.length) {
      return scoped[0];
    }
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  const tokenCandidate = findTokenItemMatch(normalizedTerm, candidates);
  if (tokenCandidate) {
    return tokenCandidate;
  }

  const fuzzyCandidate = findClosestItemMatch(normalizedTerm, candidates);
  if (fuzzyCandidate) {
    return fuzzyCandidate;
  }

  return findSubstringItemMatch(normalizedTerm, candidates);
}

function findSubstringItemMatch(normalizedTerm, candidates) {
  if (!normalizedTerm || !candidates.length) {
    return null;
  }

  const direct = candidates.find((candidate) =>
    candidate.normalizedLabel?.includes(normalizedTerm)
  );
  if (direct) {
    return direct;
  }

  return candidates.find((candidate) =>
    normalizedTerm.includes(candidate.normalizedLabel ?? "")
  );
}

function levenshteinDistance(a, b) {
  const width = b.length + 1;
  const buffer = new Array((a.length + 1) * (b.length + 1)).fill(0);

  for (let i = 0; i <= a.length; i += 1) {
    buffer[i * width] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    buffer[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const deletion = buffer[(i - 1) * width + j] + 1;
      const insertion = buffer[i * width + (j - 1)] + 1;
      const substitution = buffer[(i - 1) * width + (j - 1)] + cost;
      buffer[i * width + j] = Math.min(deletion, insertion, substitution);
    }
  }

  return buffer[a.length * width + b.length];
}

function findClosestItemMatch(normalizedTerm, candidates) {
  if (!candidates.length || !normalizedTerm) {
    return null;
  }

  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    if (!candidate.normalizedLabel) {
      return;
    }
    const distance = levenshteinDistance(
      normalizedTerm,
      candidate.normalizedLabel
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  });

  if (best && bestDistance <= 2) {
    return best;
  }
  return null;
}

function resolveCurriculumLink(record, indexes) {
  const linked = { ...record };
  const topLevel = resolveTopLevelCode(record);
  const metadata = record.metadata ?? {};

  if (metadata.is_section_header) {
    const nodeCandidate =
      pickNodeByTitle(
        record.section_title ?? record.term_lt,
        topLevel,
        indexes
      ) ?? pickNodeByTitle(record.term_lt, topLevel, indexes);

    if (!nodeCandidate) {
      throw new Error(
        `Unable to map section header '${
          record.section_title ?? record.term_lt
        }' to a curriculum node.`
      );
    }

    linked.curriculum_node_code = nodeCandidate.code;
    linked.curriculum_item_ordinal = null;
    linked.curriculum_item_label = null;
    return linked;
  }

  const parentTitle = metadata.parent_section ?? record.section_title ?? null;
  const parentNode = parentTitle
    ? pickNodeByTitle(parentTitle, topLevel, indexes)
    : null;
  const itemMatch = matchCurriculumItem(record, indexes, parentNode);

  if (!itemMatch) {
    throw new Error(
      `Unable to map concept term '${record.term_lt}' (section '${
        record.section_title ?? record.section_code
      }') to a curriculum item.`
    );
  }

  linked.curriculum_node_code = itemMatch.node_code;
  linked.curriculum_item_ordinal = itemMatch.ordinal;
  linked.curriculum_item_label = itemMatch.label;
  return linked;
}

function linkConceptsToCurriculum(records, structure) {
  const indexes = buildStructureIndexes(structure);
  const unmatched = [];
  const linkedRecords = [];

  records.forEach((record) => {
    try {
      linkedRecords.push(resolveCurriculumLink(record, indexes));
    } catch (error) {
      unmatched.push({
        slug: record.slug,
        term: record.term_lt,
        section: record.section_title ?? record.section_code ?? null,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  });

  if (unmatched.length) {
    const details = unmatched
      .slice(0, 20)
      .map(
        (entry) =>
          `- ${entry.term} (slug: ${entry.slug}${
            entry.section ? `, section: ${entry.section}` : ""
          }) ⇒ ${entry.reason}`
      )
      .join("\n");
    const suffix =
      unmatched.length > 20
        ? `\n...and ${unmatched.length - 20} more unmatched concept(s).`
        : "";
    throw new Error(
      `Unable to map ${unmatched.length} concept(s) to the curriculum structure:\n${details}${suffix}`
    );
  }

  return linkedRecords;
}

function buildValuesClause(records) {
  const rows = records.map((record) => {
    const columns = [
      escapeLiteral(record.section_code),
      escapeLiteral(record.section_title ?? null),
      escapeLiteral(record.subsection_code ?? null),
      escapeLiteral(record.subsection_title ?? null),
      escapeLiteral(record.slug),
      escapeLiteral(record.term_lt),
      escapeLiteral(record.term_en ?? null),
      escapeLiteral(record.description_lt ?? null),
      escapeLiteral(record.description_en ?? null),
      escapeLiteral(record.source_ref ?? null),
      formatBoolean(record.is_required === true),
      escapeLiteral(record.curriculum_node_code ?? null),
      formatInteger(record.curriculum_item_ordinal ?? null),
      escapeLiteral(record.curriculum_item_label ?? null),
    ];
    return `    (${columns.join(", ")})`;
  });

  return rows.join(",\n");
}

function buildSeedSql(records) {
  const header = `-- seed_concepts.sql
-- Generated ${new Date().toISOString()}

truncate table burburiuok.concepts cascade;

insert into burburiuok.concepts (
    section_code,
    section_title,
    subsection_code,
    subsection_title,
    slug,
    term_lt,
    term_en,
    description_lt,
    description_en,
    source_ref,
    is_required,
    curriculum_node_code,
    curriculum_item_ordinal,
    curriculum_item_label
) values
`;

  const footer = `

on conflict (slug) do update set
    section_code = excluded.section_code,
    section_title = excluded.section_title,
    subsection_code = excluded.subsection_code,
    subsection_title = excluded.subsection_title,
    term_lt = excluded.term_lt,
    term_en = excluded.term_en,
    description_lt = excluded.description_lt,
    description_en = excluded.description_en,
    source_ref = excluded.source_ref,
    is_required = excluded.is_required,
    curriculum_node_code = excluded.curriculum_node_code,
    curriculum_item_ordinal = excluded.curriculum_item_ordinal,
    curriculum_item_label = excluded.curriculum_item_label,
    updated_at = timezone('utc', now());
`;

  return `${header}${buildValuesClause(records)}${footer}`;
}

function normalizeSqlForComparison(content) {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/^-- Generated .*$/m, "-- Generated <normalized>")
    .trimEnd();
}

function main(options) {
  const curriculumStructure = loadCurriculumStructure();
  const { records: sourceRecords, summary: sourceSummary } =
    loadConceptRecords(curriculumStructure);
  const { records: enrichedRecords, summary } =
    applyCurriculumRequirements(sourceRecords);
  const linkedRecords = linkConceptsToCurriculum(
    enrichedRecords,
    curriculumStructure
  );

  const sql = buildSeedSql(linkedRecords);
  const finalSql = `${sql}\n`;
  let sourceSummaryDetails = "source=unknown";
  if (sourceSummary) {
    const pieces = [`source=${sourceSummary.source}`];
    if (sourceSummary.total !== undefined && sourceSummary.total !== null) {
      pieces.push(`total=${sourceSummary.total}`);
    }
    if (sourceSummary.topics && Object.keys(sourceSummary.topics).length) {
      pieces.push(
        `topics=${JSON.stringify(sourceSummary.topics).replace(/"/g, "")}`
      );
    }
    sourceSummaryDetails = pieces.join(", ");
  }
  if (options.checkOnly) {
    if (!existsSync(options.outputFile)) {
      console.error(
        `Cannot perform --check because ${options.outputFile} does not exist. Run without --check first.`
      );
      process.exit(1);
    }
    const currentContent = readFileSync(options.outputFile, "utf8");
    const normalizedCurrent = normalizeSqlForComparison(currentContent);
    const normalizedGenerated = normalizeSqlForComparison(finalSql);
    if (normalizedCurrent !== normalizedGenerated) {
      console.error(
        `Seed drift detected for ${options.outputFile}. Run without --check to update the file before committing.`
      );
      process.exit(1);
    }
    console.log(
      `Seed SQL up to date (${options.outputFile}; ${sourceSummaryDetails}; required: ${summary.required}, optional: ${summary.optional})`
    );
    return;
  }

  writeFileSync(options.outputFile, finalSql, "utf8");
  console.log(
    `Seed SQL regenerated at ${options.outputFile} (${sourceSummaryDetails}; required: ${summary.required}, optional: ${summary.optional})`
  );
}

main(cliOptions);
