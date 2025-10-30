import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DOC_PATH = path.resolve(
  __dirname,
  "../../../docs/static_info/LBS_programa.md"
);

function sanitize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTokenMatcher(docSanitized) {
  function tokenMatchesDoc(token) {
    if (token.length <= 2) return true;
    if (docSanitized.includes(token)) return true;
    if (token.includes("tc")) {
      const adjusted = token.replace(/t(?=c)/g, "");
      if (docSanitized.includes(adjusted)) return true;
    }
    for (let trim = 1; trim <= 3 && token.length - trim >= 4; trim++) {
      const truncated = token.slice(0, token.length - trim);
      if (docSanitized.includes(truncated)) return true;
    }
    return false;
  }

  return tokenMatchesDoc;
}

export function createCurriculumMatcher(docPath = DEFAULT_DOC_PATH) {
  if (!existsSync(docPath)) {
    throw new Error(`Curriculum document not found at ${docPath}`);
  }

  const docSanitized = sanitize(readFileSync(docPath, "utf8"));
  const tokenMatchesDoc = buildTokenMatcher(docSanitized);

  function isRequired(term) {
    if (!term) return false;

    const base = term.split("(")[0];
    const sanitizedBase = sanitize(base);
    if (!sanitizedBase) return false;

    if (docSanitized.includes(sanitizedBase)) {
      return true;
    }

    const tokens = sanitizedBase
      .split(" ")
      .map((token) => token.trim())
      .filter(Boolean)
      .filter((token) => token !== "ir" && token !== "bei");

    if (!tokens.length) {
      return false;
    }

    return tokens.every((token) => tokenMatchesDoc(token));
  }

  return {
    isRequired,
  };
}

export function applyCurriculumRequirements(records, matcher) {
  const activeMatcher = matcher ?? createCurriculumMatcher();

  let requiredCount = 0;
  let optionalCount = 0;

  const enriched = records.map((record) => {
    const isRequired = activeMatcher.isRequired(record.term_lt);
    if (isRequired) {
      requiredCount += 1;
    } else {
      optionalCount += 1;
    }

    return {
      ...record,
      is_required: isRequired,
    };
  });

  return {
    records: enriched,
    summary: {
      required: requiredCount,
      optional: optionalCount,
    },
  };
}
