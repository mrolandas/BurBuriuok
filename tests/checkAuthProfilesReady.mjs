#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFromDotfile() {
  const envPath = path.resolve(__dirname, "../.env");
  if (!existsSync(envPath)) {
    return;
  }

  const contents = readFileSync(envPath, "utf8");
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      return;
    }
    const [, key, rawValue] = match;
    if (process.env[key]) {
      return;
    }
    const value = rawValue.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
    process.env[key] = value;
  });
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(
      `Missing environment variable ${name}. Export it or add it to .env before starting the stack.`
    );
    process.exit(1);
  }
  return value;
}

async function assertTableExists({ label, pathSegment }) {
  const url = new URL(
    `/rest/v1/${pathSegment}?select=id&limit=1`,
    SUPABASE_URL
  );
  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: "application/json",
      "Accept-Profile": SUPABASE_SCHEMA,
    },
  });

  if (response.status === 404) {
    const body = await safeReadBody(response);
    reportMissingTable(label, body);
  }

  if (!response.ok) {
    const body = await safeReadBody(response);
    console.error(
      `Unexpected error while checking ${label}. Status ${response.status}. Response: ${body}`
    );
    process.exit(1);
  }
}

async function safeReadBody(response) {
  try {
    const text = await response.text();
    return text || "(empty response)";
  } catch (error) {
    return `(failed to decode response: ${
      error instanceof Error ? error.message : String(error)
    })`;
  }
}

function reportMissingTable(label, body) {
  console.error("");
  console.error(`Required Supabase table missing: ${label}.`);
  console.error(
    "Apply migration supabase/migrations/0013_auth_profiles.sql to your target project."
  );
  console.error("Typical commands:");
  console.error("  npx supabase db push --include-seed");
  console.error(
    "  # or if you target a remote ref: npx supabase db push --project-ref <ref> --include-seed"
  );
  console.error(
    "If you use the hosted project, export SUPABASE_ACCESS_TOKEN (and SUPABASE_DB_PASSWORD when prompted)."
  );
  console.error("Once the migration succeeds, rerun scripts/start_stack.sh.");
  console.error("Server response was:", body);
  console.error("");
  process.exit(1);
}

loadEnvFromDotfile();

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_SCHEMA = process.env.SUPABASE_AUTH_SCHEMA || "burburiuok";

const checks = [
  { label: `${SUPABASE_SCHEMA}.profiles`, pathSegment: "profiles" },
  {
    label: `${SUPABASE_SCHEMA}.admin_invites`,
    pathSegment: "admin_invites",
  },
];

const tasks = checks.map((check) => assertTableExists(check));
Promise.all(tasks)
  .then(() => {
    console.log("Supabase profile/admin tables detected.");
  })
  .catch((error) => {
    console.error("Unexpected error while checking Supabase metadata:", error);
    process.exit(1);
  });
