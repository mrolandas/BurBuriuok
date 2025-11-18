#!/usr/bin/env ts-node

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getSupabaseClient, resetSupabaseClients } from "../data/supabaseClient.ts";

type EnvKey = "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "SUPABASE_ANON_KEY";

type ConceptRow = {
  id: string;
};

type MediaAssetRow = {
  id: string;
  concept_id: string;
  storage_path: string;
};

function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env");
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
    const [, key, raw] = match;
    if (process.env[key]) {
      return;
    }
    const value = raw.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
    process.env[key] = value;
  });
}

function assertEnv(name: EnvKey): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function insertTestConcept(supabase: any, slug: string): Promise<string> {
  const now = new Date().toISOString();
  const payload = {
    section_code: "TST",
    section_title: "Testing Section",
    slug,
    term_lt: `Test concept ${slug}`,
    term_en: null,
    description_lt: "Media asset test concept",
    metadata: { status: "draft", createdVia: "media-assets-test" },
    is_required: false,
    created_at: now,
    updated_at: now,
  };

  const { error: insertError } = await supabase.from("concepts").insert(payload);
  if (insertError) {
    throw new Error(`Failed to insert concept '${slug}': ${insertError.message}`);
  }

  const { data, error } = await supabase
    .from("concepts")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load concept '${slug}': ${error.message}`);
  }

  expect(data, `Concept '${slug}' not found after insert`);
  return (data as ConceptRow).id;
}

async function cleanup(supabase: any, conceptId: string, conceptSlug: string, assetId?: string): Promise<void> {
  if (assetId) {
    await supabase.from("media_asset_variants").delete().eq("asset_id", assetId);
    await supabase.from("media_assets").delete().eq("id", assetId);
  } else {
    await supabase.from("media_asset_variants").delete().eq("asset_id", conceptId);
    await supabase.from("media_assets").delete().eq("concept_id", conceptId);
  }
  await supabase.from("concepts").delete().eq("slug", conceptSlug);
}

async function main(): Promise<void> {
  loadEnv();
  assertEnv("SUPABASE_URL");
  assertEnv("SUPABASE_SERVICE_ROLE_KEY");
  assertEnv("SUPABASE_ANON_KEY");

  const adminClient = getSupabaseClient({ service: true, schema: "burburiuok" }) as any;
  const anonClient = getSupabaseClient({ schema: "burburiuok" }) as any;

  const slug = `media001-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const conceptId = await insertTestConcept(adminClient, slug);
  const assetId = randomUUID();
  const storagePath = `concept/${conceptId}/${assetId}.jpg`;

  try {
    const { data: insertData, error: insertError } = await adminClient
      .from("media_assets")
      .insert({
        id: assetId,
        concept_id: conceptId,
        asset_type: "image",
        storage_path: storagePath,
        title: "Test asset",
        caption_lt: "Test caption LT",
        caption_en: "Test caption EN",
        created_by: "media-assets-test",
      })
      .select("id, concept_id, storage_path")
      .maybeSingle();

    if (insertError) {
      throw new Error(`Admin insert failed: ${insertError.message}`);
    }

    expect(insertData, "Admin insert did not return inserted asset");

    const { data: adminFetched, error: adminFetchError } = await adminClient
      .from("media_assets")
      .select("id, concept_id, storage_path")
      .eq("id", assetId)
      .maybeSingle();

    if (adminFetchError) {
      throw new Error(`Admin select failed: ${adminFetchError.message}`);
    }

    expect(adminFetched, "Admin select did not return media asset");

    const { data: anonData, error: anonError } = await anonClient
      .from("media_assets")
      .select("id")
      .eq("id", assetId)
      .maybeSingle();

    expect(anonError, "Learner client should not be able to read media assets");
    expect(!anonData, "Learner client unexpectedly read media asset");

    const { error: anonInsertError } = await anonClient.from("media_assets").insert({
      concept_id: conceptId,
      asset_type: "image",
      storage_path: `concept/${conceptId}/forbidden.jpg`,
      created_by: "unauthorised",
    });

    expect(anonInsertError, "Learner client should not be able to insert media assets");

    console.log("✅ MEDIA-001 media asset policy smoke test passed");
  } finally {
    await cleanup(adminClient, conceptId, slug, assetId);
    resetSupabaseClients();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("❌ MEDIA-001 media asset policy smoke test failed", error);
  resetSupabaseClients();
  process.exit(1);
});
