#!/usr/bin/env ts-node

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import mediaRouter from "../backend/src/routes/admin/media.ts";
import { getSupabaseClient, resetSupabaseClients } from "../data/supabaseClient.ts";

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

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

type ConceptRow = {
  id: string;
};

type MediaAssetRow = {
  id: string;
};

type SupabaseAny = any;

const MEDIA_BUCKET = "media-admin";

async function insertTestConcept(supabase: SupabaseAny, slug: string): Promise<string> {
  const now = new Date().toISOString();
  const payload = {
    section_code: "TST",
    section_title: "Testing Section",
    slug,
    term_lt: `Test concept ${slug}`,
    term_en: null,
    description_lt: "Media admin API test concept",
    metadata: { status: "draft", createdVia: "media-admin-api-test" },
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
    throw new Error(`Failed to lookup concept '${slug}': ${error.message}`);
  }

  expect(data, `Concept '${slug}' not found after insert`);
  return (data as ConceptRow).id;
}

async function deleteConcept(supabase: SupabaseAny, slug: string): Promise<void> {
  await supabase.from("concepts").delete().eq("slug", slug);
}

async function cleanupAssets(supabase: SupabaseAny, conceptId: string): Promise<void> {
  const { data } = await supabase
    .from("media_assets")
    .select("id")
    .eq("concept_id", conceptId);

  const ids = (data ?? []).map((row: MediaAssetRow) => row.id);
  if (ids.length > 0) {
    await supabase.from("media_assets").delete().in("id", ids);
  }
}

async function startServer(app: express.Application): Promise<{ server: Server; baseUrl: string }> {
  const server: Server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Could not determine server address");
  }

  const port = (address as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1/admin/media`;
  return { server, baseUrl };
}

function createMediaApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).authUser = {
      id: "media-admin-test",
      email: "media-admin-test@example.com",
      appRole: "admin",
    };
    next();
  });
  app.use("/api/v1/admin/media", mediaRouter);
  return app;
}

async function ensureMediaBucketExists(supabase: SupabaseAny): Promise<void> {
  const { data } = await supabase.storage.getBucket(MEDIA_BUCKET);
  if (data) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(MEDIA_BUCKET, {
    public: false,
  });

  if (createError && !/already exists/i.test(createError.message ?? "")) {
    throw new Error(`Failed to create media bucket: ${createError.message}`);
  }
}

async function main(): Promise<void> {
  loadEnv();
  assertEnv("SUPABASE_URL");
  assertEnv("SUPABASE_SERVICE_ROLE_KEY");
  assertEnv("SUPABASE_ANON_KEY");

  process.env.ADMIN_DEV_IMPERSONATION = process.env.ADMIN_DEV_IMPERSONATION ?? "true";

  const supabase = getSupabaseClient({ service: true, schema: "burburiuok" }) as SupabaseAny;

  const slug = `media002-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const conceptId = await insertTestConcept(supabase, slug);

  await ensureMediaBucketExists(supabase);

  const { server, baseUrl } = await startServer(createMediaApp());

  const impersonationHeaders = {
    "x-admin-impersonate": "true",
  } as Record<string, string>;

  const createdAssetIds: string[] = [];

  try {
    const uploadResponse = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...impersonationHeaders,
      },
      body: JSON.stringify({
        conceptId,
        assetType: "image",
        title: "Test upload asset",
        captionLt: "LT caption",
        captionEn: "EN caption",
        source: {
          kind: "upload",
          fileName: "test-image.jpg",
          fileSize: 1024,
          contentType: "image/jpeg",
        },
      }),
    });

    expect(uploadResponse.ok, `Upload asset request failed (${uploadResponse.status})`);
    const uploadJson = await uploadResponse.json();

    const uploadAssetId = uploadJson?.data?.asset?.id as string | undefined;
    expect(uploadAssetId, "Upload asset ID missing in response");
    createdAssetIds.push(uploadAssetId as string);

    const uploadStoragePath = uploadJson?.data?.asset?.storagePath as string | undefined;
    expect(uploadStoragePath, "Upload storage path missing in response");

    const { error: seedUploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(uploadStoragePath as string, Buffer.from("media-test"), {
        contentType: "image/jpeg",
        upsert: true,
      });

    expect(!seedUploadError, `Failed to seed upload object: ${seedUploadError?.message ?? ""}`);

    const uploadInstructions = uploadJson?.data?.upload;
    expect(uploadInstructions, "Upload instructions missing");
    expect(typeof uploadInstructions.url === "string", "Upload URL missing");
    expect(typeof uploadInstructions.token === "string", "Upload token missing");

    const externalResponse = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...impersonationHeaders,
      },
      body: JSON.stringify({
        conceptId,
        assetType: "video",
        title: "External video",
        captionLt: "Išorinis video",
        source: {
          kind: "external",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      }),
    });

    expect(externalResponse.ok, `External asset request failed (${externalResponse.status})`);
    const externalJson = await externalResponse.json();

    const externalAssetId = externalJson?.data?.asset?.id as string | undefined;
    expect(externalAssetId, "External asset ID missing in response");
    createdAssetIds.push(externalAssetId as string);
    expect(!externalJson?.data?.upload, "External asset should not return upload instructions");

    const listResponse = await fetch(`${baseUrl}?conceptId=${conceptId}&limit=10`, {
      headers: impersonationHeaders,
    });

    expect(listResponse.ok, "List request failed");
    const listJson = await listResponse.json();
    const items = listJson?.data?.items as Array<Record<string, unknown>> | undefined;
    expect(items && items.length === 2, "List should return two assets for concept");

    const detailResponse = await fetch(`${baseUrl}/${uploadAssetId}`, {
      headers: impersonationHeaders,
    });

    expect(detailResponse.ok, `Detail request failed (${detailResponse.status})`);
    const detailJson = await detailResponse.json();
    expect(detailJson?.data?.asset?.id === uploadAssetId, "Detail response returned wrong asset");

    const signedUrlResponse = await fetch(`${baseUrl}/${uploadAssetId}/url`, {
      headers: impersonationHeaders,
    });

    expect(signedUrlResponse.ok, "Signed URL request failed for upload asset");
    const signedUrlJson = await signedUrlResponse.json();
    expect(signedUrlJson?.data?.kind === "supabase-signed-url", "Unexpected signed URL kind");
    expect(typeof signedUrlJson?.data?.url === "string", "Signed URL missing");

    const externalUrlResponse = await fetch(`${baseUrl}/${externalAssetId}/url`, {
      headers: impersonationHeaders,
    });

    expect(externalUrlResponse.ok, "Signed URL request failed for external asset");
    const externalUrlJson = await externalUrlResponse.json();
    expect(externalUrlJson?.data?.kind === "external", "External asset should return external kind");
    expect(externalUrlJson?.data?.url === "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "External URL mismatch");

    const deleteUploadResponse = await fetch(`${baseUrl}/${uploadAssetId}`, {
      method: "DELETE",
      headers: impersonationHeaders,
    });

    expect(deleteUploadResponse.ok, `Delete upload asset failed (${deleteUploadResponse.status})`);
    const deleteUploadJson = await deleteUploadResponse.json();
    expect(deleteUploadJson?.data?.deletedId === uploadAssetId, "Deleted upload asset ID mismatch");
    expect(["removed", "missing", "skipped"].includes(deleteUploadJson?.data?.storageStatus), "Unexpected storage status for upload asset");

    const deleteExternalResponse = await fetch(`${baseUrl}/${externalAssetId}`, {
      method: "DELETE",
      headers: impersonationHeaders,
    });

    expect(deleteExternalResponse.ok, `Delete external asset failed (${deleteExternalResponse.status})`);
    const deleteExternalJson = await deleteExternalResponse.json();
    expect(deleteExternalJson?.data?.deletedId === externalAssetId, "Deleted external asset ID mismatch");
    expect(deleteExternalJson?.data?.storageStatus === "skipped", "External asset delete should skip storage removal");

    const remaining = await supabase
      .from("media_assets")
      .select("id")
      .eq("concept_id", conceptId);

    expect(!remaining.error, `Failed to check remaining assets: ${remaining.error?.message ?? ""}`);
    expect((remaining.data ?? []).length === 0, "Media assets should be cleaned up after delete");

    console.log("✅ MEDIA-002 admin media API smoke test passed");
  } finally {
    createdAssetIds.reverse();
    for (const assetId of createdAssetIds) {
      await supabase.from("media_assets").delete().eq("id", assetId);
    }
    await deleteConcept(supabase, slug);
    await cleanupAssets(supabase, conceptId);
    resetSupabaseClients();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("❌ MEDIA-002 admin media API smoke test failed", error);
  resetSupabaseClients();
  process.exit(1);
});
