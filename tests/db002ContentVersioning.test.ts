#!/usr/bin/env ts-node

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { resetSupabaseClients, getSupabaseClient } from "../data/supabaseClient.ts";
import { logContentMutation } from "../backend/src/services/auditLogger.ts";
import { getContentVersionById } from "../data/repositories/contentVersionsRepository.ts";
import type { ContentVersionDbRow } from "../data/repositories/contentVersionsRepository.ts";

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

function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function expectTrue(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

type ConceptRow = {
  id: string;
  slug: string;
  term_lt: string;
  term_en: string | null;
  description_lt: string | null;
  description_en: string | null;
  section_code: string;
  section_title: string | null;
  subsection_code: string | null;
  subsection_title: string | null;
  curriculum_node_code: string | null;
  curriculum_item_ordinal: number | null;
  curriculum_item_label: string | null;
  source_ref: string | null;
  metadata: Record<string, unknown> | null;
  is_required: boolean | null;
  created_at: string;
  updated_at: string;
};

function getTermLt(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }
  const record = snapshot as Record<string, unknown>;
  const value = record.termLt;
  return typeof value === "string" ? value : null;
}

function toAdminConceptPayload(row: ConceptRow): Record<string, unknown> {
  const metadata = (row.metadata && typeof row.metadata === "object")
    ? { ...(row.metadata as Record<string, unknown>) }
    : {};
  const status = typeof metadata.status === "string" ? (metadata.status as string) : "draft";
  metadata.status = status;

  return {
    id: row.id,
    slug: row.slug,
    termLt: row.term_lt,
    termEn: row.term_en ?? null,
    descriptionLt: row.description_lt ?? null,
    descriptionEn: row.description_en ?? null,
    sectionCode: row.section_code,
    sectionTitle: row.section_title ?? row.section_code,
    subsectionCode: row.subsection_code ?? null,
    subsectionTitle: row.subsection_title ?? null,
    curriculumNodeCode: row.curriculum_node_code ?? null,
    curriculumItemOrdinal: row.curriculum_item_ordinal ?? null,
    curriculumItemLabel: row.curriculum_item_label ?? row.term_lt ?? null,
    sourceRef: row.source_ref ?? null,
    isRequired: row.is_required ?? false,
    metadata,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchConcept(supabase: any, slug: string): Promise<ConceptRow> {
  const { data, error } = await supabase
    .from("concepts")
    .select(
      "id, slug, term_lt, term_en, description_lt, description_en, section_code, section_title, subsection_code, subsection_title, curriculum_node_code, curriculum_item_ordinal, curriculum_item_label, source_ref, metadata, is_required, created_at, updated_at"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch concept '${slug}': ${error.message}`);
  }

  if (!data) {
    throw new Error(`Concept '${slug}' was not found.`);
  }

  return data as ConceptRow;
}

async function fetchDraftPayload(supabase: any, slug: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("content_drafts")
    .select("payload")
    .eq("entity_type", "concept")
    .eq("entity_primary_key", slug)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to read content draft for '${slug}': ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return data.payload as Record<string, unknown> | null;
}

async function cleanup(supabase: any, slug: string): Promise<void> {
  await supabase.from("content_drafts").delete().eq("entity_type", "concept").eq("entity_primary_key", slug);
  await supabase.from("content_versions").delete().eq("entity_type", "concept").eq("entity_primary_key", slug);
  await supabase.from("concepts").delete().eq("slug", slug);
}

async function main(): Promise<void> {
  loadEnv();
  assertEnv("SUPABASE_URL");
  assertEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = getSupabaseClient({ service: true, schema: "burburiuok" }) as any;

  const slug = `db002-test-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const initialTerm = "DB002 Draft Term";
  const updatedTerm = "DB002 Draft Term Updated";
  const publishedTerm = "DB002 Published Term";

  try {
    const now = new Date().toISOString();
    const insertPayload = {
      section_code: "TST",
      section_title: "Testing Section",
      slug,
      term_lt: initialTerm,
      term_en: null,
      description_lt: "Test draft description",
      metadata: { status: "draft", createdVia: "db002-test" },
      is_required: false,
      created_at: now,
      updated_at: now,
    };

    const { error: insertError } = await supabase.from("concepts").insert(insertPayload);
    if (insertError) {
      throw new Error(`Failed to insert concept '${slug}': ${insertError.message}`);
    }

    const initialRow = await fetchConcept(supabase, slug);
    const initialPayload = toAdminConceptPayload(initialRow);

    const { error: draftUpdateError } = await supabase
      .from("concepts")
      .update({ term_lt: updatedTerm, updated_at: new Date().toISOString() })
      .eq("slug", slug);
    if (draftUpdateError) {
      throw new Error(`Failed to update concept to draft state: ${draftUpdateError.message}`);
    }

    const draftRow = await fetchConcept(supabase, slug);
    const draftPayload = toAdminConceptPayload(draftRow);

    const draftVersionId = await logContentMutation({
      entityType: "concept",
      entityId: slug,
      before: initialPayload,
      after: draftPayload,
      actor: "db002-test",
      status: "draft",
      changeSummary: "db002 draft save",
    });

    expectTrue(typeof draftVersionId === "string" && draftVersionId.length > 0, "Draft mutation did not return a version id");

    const draftedVersion = (await getContentVersionById(draftVersionId)) as ContentVersionDbRow | null;
    expectTrue(draftedVersion !== null, "Draft version could not be reloaded");
    const draftedSnapshotTerm = getTermLt((draftedVersion as ContentVersionDbRow).snapshot);
    expectTrue(draftedSnapshotTerm === updatedTerm, "Draft snapshot term mismatch");

    const draftRecord = await fetchDraftPayload(supabase, slug);
    expectTrue(draftRecord !== null, "Draft record was not persisted");
    const draftPayloadTerm = getTermLt(draftRecord);
    expectTrue(draftPayloadTerm === updatedTerm, "Draft payload term mismatch");

    const { error: publishUpdateError } = await supabase
      .from("concepts")
      .update({ term_lt: publishedTerm, updated_at: new Date().toISOString() })
      .eq("slug", slug);
    if (publishUpdateError) {
      throw new Error(`Failed to update concept to published state: ${publishUpdateError.message}`);
    }

    const publishedRow = await fetchConcept(supabase, slug);
    const publishedPayload = toAdminConceptPayload(publishedRow);

    const publishVersionId = await logContentMutation({
      entityType: "concept",
      entityId: slug,
      before: draftPayload,
      after: publishedPayload,
      actor: "db002-test",
      status: "published",
      changeSummary: "db002 publish save",
    });

    expectTrue(typeof publishVersionId === "string" && publishVersionId.length > 0, "Publish mutation did not return a version id");

    const remainingDraft = await fetchDraftPayload(supabase, slug);
    expectTrue(remainingDraft === null, "Draft record should be removed after publish");

    const publishVersion = (await getContentVersionById(publishVersionId)) as ContentVersionDbRow | null;
    expectTrue(publishVersion !== null, "Publish version could not be reloaded");
    const publishSnapshotTerm = getTermLt((publishVersion as ContentVersionDbRow).snapshot);
    expectTrue(publishSnapshotTerm === publishedTerm, "Publish snapshot term mismatch");

    console.log("✅ DB-002 content versioning smoke test passed");
  } finally {
    await cleanup(supabase, slug);
    resetSupabaseClients();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("❌ DB-002 content versioning smoke test failed", error);
  resetSupabaseClients();
  process.exit(1);
});
