import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8");
  envConfig.split("\n").forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["'](.*)["']$/, "$1");
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSqlFile(filePath) {
  console.log(`Running SQL from ${filePath}...`);
  const sql = fs.readFileSync(filePath, "utf8");

  // Split by statement if possible, but Supabase JS client doesn't support raw SQL execution easily without an RPC or direct connection.
  // However, for seeds, we often use the postgres connection string.
  // Since I don't have the postgres connection string in the env (only the API URL),
  // I will try to use the `rpc` if a raw_sql function exists, or warn the user.

  // Actually, looking at the project structure, there might be a way to run migrations/seeds via the backend or a specific tool.
  // But since I cannot use `psql` easily without the connection string (which is usually part of the project secrets but not visible here),
  // I will try to use the `pg` library if available or just instruct the user.

  // Wait, I can try to use the `postgres` library if it's in node_modules.

  try {
    // Check if we can use the backend's db connection?
    // The backend uses supabase-js.

    // Let's try to use a custom RPC if it exists, otherwise we might be stuck.
    // But wait, the user asked me to "make the adjustment".

    // If I can't reset the DB, I can at least update the data via the API.
    // But the seeds are SQL files.

    console.log(
      "Cannot execute raw SQL via Supabase JS client directly without an RPC."
    );
    console.log(
      "Please run the following commands in your terminal if you have psql installed and the connection string:"
    );
    console.log(`psql <DB_CONNECTION_STRING> -f ${filePath}`);
  } catch (e) {
    console.error(e);
  }
}

// Actually, I'll try to update the nodes via the API since I have the JSON structure.
// This is safer and doesn't require direct DB access.

async function updateCurriculumFromJSON() {
  const structurePath = path.resolve(
    __dirname,
    "../content/raw/curriculum_structure.json"
  );
  const structure = JSON.parse(fs.readFileSync(structurePath, "utf8"));

  console.log("Syncing curriculum nodes...");

  // Upsert nodes
  // We need to be careful with foreign keys (parent_code).
  // Best to insert roots first, then children.

  // The structure is already sorted by level.

  for (const node of structure.nodes) {
    const { error } = await supabase.from("burburiuok_curriculum_nodes").upsert(
      {
        code: node.code,
        title: node.title,
        summary: node.summary,
        level: node.level,
        parent_code: node.parent_code,
        ordinal: node.ordinal,
      },
      { onConflict: "code" }
    );

    if (error) {
      console.error(`Error upserting node ${node.code}:`, error);
    } else {
      // console.log(`Upserted ${node.code}`);
    }
  }

  console.log("Curriculum nodes synced.");
}

async function updateConceptsFromJSON() {
  const rawDir = path.resolve(__dirname, "../content/raw");
  const files = fs
    .readdirSync(rawDir)
    .filter((f) => f.endsWith("_concepts.json"));

  console.log("Syncing concepts...");

  for (const file of files) {
    const content = JSON.parse(
      fs.readFileSync(path.join(rawDir, file), "utf8")
    );
    for (const concept of content) {
      // We need to find the concept by slug and update its curriculum_node_code
      // Or upsert it entirely.

      // Fallback for curriculum_node_code if missing
      let nodeCode = concept.curriculum_node_code;
      if (!nodeCode) {
        if (concept.subsection_code) {
          nodeCode = concept.subsection_code;
        } else if (concept.section_code) {
          nodeCode = concept.section_code;
        }
      }

      const payload = {
        slug: concept.slug,
        term_lt: concept.term_lt,
        term_en: concept.term_en,
        description_lt: concept.description_lt,
        description_en: concept.description_en,
        section_code: concept.section_code,
        section_title: concept.section_title,
        subsection_code: concept.subsection_code,
        subsection_title: concept.subsection_title,
        curriculum_node_code: nodeCode,
        source_ref: concept.source_ref,
        is_required: concept.metadata?.curriculum_required ?? false,
        metadata: concept.metadata,
      };

      const { error } = await supabase
        .from("burburiuok_concepts")
        .upsert(payload, { onConflict: "slug" });

      if (error) {
        console.error(`Error upserting concept ${concept.slug}:`, error);
      }
    }
  }
  console.log("Concepts synced.");
}

async function wipeData() {
  console.log("Wiping existing data...");

  // Delete concept_progress (references concepts)
  const { error: progressError } = await supabase
    .from("burburiuok_concept_progress")
    .delete()
    .neq("concept_id", "00000000-0000-0000-0000-000000000000");

  if (progressError) {
    console.error("Error wiping progress:", progressError);
  } else {
    console.log("Progress wiped.");
  }

  // Delete concepts first (they refer to nodes)
  const { error: conceptsError } = await supabase
    .from("burburiuok_concepts")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

  if (conceptsError) {
    console.error("Error wiping concepts:", conceptsError);
    // Continue anyway, maybe table is empty or RLS prevents it (but we use service key)
  } else {
    console.log("Concepts wiped.");
  }

  // Delete nodes
  // Since we have ON DELETE CASCADE on parent_code, deleting roots should clear everything.
  // But safer to just delete all.
  const { error: nodesError } = await supabase
    .from("burburiuok_curriculum_nodes")
    .delete()
    .neq("code", "_____"); // Delete all

  if (nodesError) {
    console.error("Error wiping nodes:", nodesError);
  } else {
    console.log("Nodes wiped.");
  }
}

async function main() {
  await wipeData();
  await updateCurriculumFromJSON();
  await updateConceptsFromJSON();
}

main();
