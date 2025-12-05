#!/usr/bin/env node

// Minimal connectivity test to ensure the hosted Supabase project is reachable via REST.
// Usage: `node tests/checkSupabaseConnection.mjs`

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

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

function requireEnv(variableName) {
  const value = process.env[variableName];
  if (!value) {
    console.error(
      `Missing environment variable ${variableName}. Export it in your shell or add it to .env before running this test.`
    );
    process.exit(1);
  }
  return value;
}

async function main() {
  loadEnvFromDotfile();

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");

  const endpoint = new URL(
    "/rest/v1/burburiuok_concepts?select=id&limit=1",
    supabaseUrl
  ).toString();

  try {
    const headers = {
      apikey: anonKey,
      Accept: "application/json",
    };

    // If the key is a legacy JWT (doesn't start with "sb_"), we must send it as a Bearer token.
    // If it's a new Supabase API key (starts with "sb_"), we should NOT send it in the Authorization header
    // with "Bearer", as it's not a JWT. The 'apikey' header is sufficient.
    if (!anonKey.startsWith("sb_")) {
      headers.Authorization = `Bearer ${anonKey}`;
    }

    const response = await fetch(endpoint, {
      headers,
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `Supabase connectivity test failed with status ${response.status}. Response body: ${body}`
      );
      process.exit(1);
    }

    await response.json();
    console.log(
      `Supabase connectivity test succeeded (status ${response.status}).`
    );
  } catch (error) {
    console.error("Unexpected error while contacting Supabase:", error);
    process.exit(1);
  }
}

main();
