#!/usr/bin/env node

// Generates Supabase seed SQL from raw concept JSON data.
// Usage: `node content/scripts/build_seed_sql.mjs`

import { readFileSync, readdirSync, writeFileSync } from "fs";
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
  ].map(([key, value]) => [normalizeCurriculumString(key), value])
);

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
  metadata: z.record(z.any()).optional(),
});

function loadConceptRecords() {
  const files = readdirSync(RAW_DIR)
    .filter((file) => /^section_[a-z0-9_]+_concepts\.json$/i.test(file))
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

function main() {
  const parsedRecords = loadConceptRecords();
  const curriculumStructure = loadCurriculumStructure();
  const { records: enrichedRecords, summary } =
    applyCurriculumRequirements(parsedRecords);
  const linkedRecords = linkConceptsToCurriculum(
    enrichedRecords,
    curriculumStructure
  );

  const sql = buildSeedSql(linkedRecords);
  writeFileSync(OUTPUT_FILE, `${sql}\n`, "utf8");
  console.log(
    `Seed SQL regenerated at ${OUTPUT_FILE} (required: ${summary.required}, optional: ${summary.optional})`
  );
}

main();
