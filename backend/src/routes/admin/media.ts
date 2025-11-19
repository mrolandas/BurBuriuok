import { Router } from "express";
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { URL } from "node:url";
import {
  adminMediaAssetTypeSchema,
  adminMediaCreateSchema,
  adminMediaListQuerySchema,
  adminMediaSignedUrlQuerySchema,
  type AdminMediaCreateInput,
} from "../../../../shared/validation/adminMediaAssetSchema.ts";
import { getSupabaseClient } from "../../../../data/supabaseClient.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { HttpError } from "../../utils/httpError.ts";
import { createRateLimiter } from "../../middleware/rateLimiter.ts";
import {
  MEDIA_BUCKET,
  SIGNED_URL_DEFAULT_EXPIRY,
  UPLOAD_URL_EXPIRY_SECONDS,
  type MediaAssetRow,
  mapMediaAssetForResponse,
  isExternalStoragePath,
  buildExternalStoragePath,
  extractAdminIdentifier,
} from "../media/shared.ts";
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const DAILY_MS = 24 * 60 * 60 * 1000;

const ADMIN_MEDIA_UPLOADS_PER_DAY = getPositiveIntFromEnv("ADMIN_MEDIA_UPLOADS_PER_DAY", 40);
const ADMIN_MEDIA_UPLOAD_BURST = getPositiveIntFromEnv("ADMIN_MEDIA_UPLOAD_BURST", 10);
const ADMIN_MEDIA_DELETES_PER_DAY = getPositiveIntFromEnv("ADMIN_MEDIA_DELETES_PER_DAY", 80);
const ADMIN_MEDIA_DELETE_BURST = getPositiveIntFromEnv("ADMIN_MEDIA_DELETE_BURST", 20);

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4"]);

const CONTENT_TYPE_EXTENSION_MAP = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["video/mp4", ".mp4"],
]);

const ALLOWED_EXTERNAL_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "m.youtube.com",
  "vimeo.com",
  "player.vimeo.com",
]);

const router = Router();

const mediaCreateRateLimiter = createRateLimiter({
  limit: ADMIN_MEDIA_UPLOADS_PER_DAY,
  windowMs: DAILY_MS,
  burst: ADMIN_MEDIA_UPLOAD_BURST,
  name: "admin-media-create",
  keyExtractor: extractAdminIdentifier,
  onLimitExceeded: ({ res, retryAfterSeconds }) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Viršyta leidžiamų medijos įkėlimų kvota. Bandykite dar kartą vėliau.",
        retryAfterSeconds,
      },
    });
  },
});

const mediaDeleteRateLimiter = createRateLimiter({
  limit: ADMIN_MEDIA_DELETES_PER_DAY,
  windowMs: DAILY_MS,
  burst: ADMIN_MEDIA_DELETE_BURST,
  name: "admin-media-delete",
  keyExtractor: extractAdminIdentifier,
  onLimitExceeded: ({ res, retryAfterSeconds }) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Viršyta leidžiamų medijos trynimų kvota. Bandykite dar kartą vėliau.",
        retryAfterSeconds,
      },
    });
  },
});

router.post(
  "/",
  mediaCreateRateLimiter,
  asyncHandler(async (req, res) => {
    const parsed = adminMediaCreateSchema.safeParse(req.body);

    if (!parsed.success) {
      sendValidationError(res, parsed.error.flatten().fieldErrors);
      return;
    }

    const payload = parsed.data;

    if (payload.source.kind === "upload" && payload.source.fileSize > MAX_UPLOAD_BYTES) {
      res.status(422).json({
        error: {
          code: "FILE_TOO_LARGE",
          message: "Failas negali būti didesnis nei 50 MB.",
        },
      });
      return;
    }

    const supabase = getSupabaseClient({ service: true, schema: "burburiuok" }) as any;

    const conceptExists = await ensureConceptExists(supabase, payload.conceptId);
    if (!conceptExists) {
      res.status(404).json({
        error: {
          code: "CONCEPT_NOT_FOUND",
          message: "Nurodytas konceptas nerastas.",
        },
      });
      return;
    }

    const actor = req.authUser?.email ?? req.authUser?.id ?? "system";
    const assetId = randomUUID();

    let storagePath: string;
    let externalUrl: string | null = null;
    let uploadInstructions: UploadInstruction | null = null;

    if (payload.source.kind === "upload") {
      validateUploadPayload(payload);
      const extension = resolveUploadExtension(payload);
      storagePath = buildUploadStoragePath(payload.conceptId, assetId, extension);
      uploadInstructions = await createSignedUploadUrl(supabase, {
        storagePath,
        contentType: payload.source.contentType,
      });
    } else {
      validateExternalUrl(payload.source.url);
      externalUrl = payload.source.url;
      storagePath = buildExternalStoragePath(assetId);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("media_assets")
      .insert({
        id: assetId,
        concept_id: payload.conceptId,
        asset_type: payload.assetType,
        storage_path: storagePath,
        external_url: externalUrl,
        title: payload.title,
        caption_lt: payload.captionLt,
        caption_en: payload.captionEn,
        created_by: actor,
      })
      .select(
        "id, concept_id, asset_type, storage_path, external_url, title, caption_lt, caption_en, created_by, created_at, concepts:concept_id (slug, term_lt, term_en)"
      )
      .maybeSingle();

    if (insertError) {
      throw insertError;
    }

    if (!inserted) {
      throw new HttpError(500, "Nepavyko sukurti medijos įrašo.");
    }

    const responseAsset = mapMediaAssetForResponse(inserted as MediaAssetRow);

    // eslint-disable-next-line no-console
    console.info("[media] asset_created", {
      assetId,
      conceptId: payload.conceptId,
      actor,
      sourceKind: payload.source.kind,
    });

    res.status(201).json({
      data: {
        asset: responseAsset,
        upload: uploadInstructions,
      },
      meta: {
        createdAt: new Date().toISOString(),
      },
    });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = adminMediaListQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      sendValidationError(res, parsed.error.flatten().fieldErrors);
      return;
    }

    const { conceptId, assetType, sourceKind, search, limit, cursor } = parsed.data;
    const supabase = getSupabaseClient({ service: true, schema: "burburiuok" }) as any;

    let query = supabase
      .from("media_assets")
      .select(
        "id, concept_id, asset_type, storage_path, external_url, title, caption_lt, caption_en, created_by, created_at, concepts:concept_id (slug, term_lt, term_en)"
      )
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (conceptId) {
      query = query.eq("concept_id", conceptId);
    }

    if (assetType) {
      const validatedType = adminMediaAssetTypeSchema.parse(assetType);
      query = query.eq("asset_type", validatedType);
    }

    if (sourceKind === "upload") {
      query = query.is("external_url", null);
    } else if (sourceKind === "external") {
      query = query.not("external_url", "is", null);
    }

    if (cursor) {
      const normalizedCursor = normalizeCursor(cursor);
      query = query.lt("created_at", normalizedCursor);
    }

    if (search) {
      const pattern = buildIlikePattern(search);
      if (pattern) {
        query = query.or(
          [
            `title.ilike.${pattern}`,
            `caption_lt.ilike.${pattern}`,
            `caption_en.ilike.${pattern}`,
            `storage_path.ilike.${pattern}`
          ].join(",")
        );
      }
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as MediaAssetRow[];
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => mapMediaAssetForResponse(row));
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt ?? null : null;

    res.json({
      data: {
        items,
      },
      meta: {
        count: items.length,
        hasMore,
        nextCursor,
        fetchedAt: new Date().toISOString(),
      },
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id?.trim();

    if (!id) {
      res.status(400).json({
        error: {
          code: "MEDIA_ID_REQUIRED",
          message: "Medijos ID privalomas.",
        },
      });
      return;
    }

    const supabase = getSupabaseClient({ service: true, schema: "burburiuok" }) as any;

    const { data, error } = await supabase
      .from("media_assets")
      .select(
        "id, concept_id, asset_type, storage_path, external_url, title, caption_lt, caption_en, created_by, created_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      res.status(404).json({
        error: {
          code: "MEDIA_NOT_FOUND",
          message: "Medijos įrašas nerastas.",
        },
      });
      return;
    }

    res.json({
      data: {
        asset: mapMediaAssetForResponse(data as MediaAssetRow),
      },
      meta: {
        fetchedAt: new Date().toISOString(),
      },
    });
  })
);

router.get(
  "/:id/url",
  asyncHandler(async (req, res) => {
    const id = req.params.id?.trim();

    if (!id) {
      res.status(400).json({
        error: {
          code: "MEDIA_ID_REQUIRED",
          message: "Medijos ID privalomas.",
        },
      });
      return;
    }

    const parsed = adminMediaSignedUrlQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      sendValidationError(res, parsed.error.flatten().fieldErrors);
      return;
    }

    const { expiresIn } = parsed.data;
    const supabase = getSupabaseClient({ service: true, schema: "burburiuok" }) as any;

    const { data, error } = await supabase
      .from("media_assets")
      .select("id, storage_path, external_url, asset_type")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      res.status(404).json({
        error: {
          code: "MEDIA_NOT_FOUND",
          message: "Medijos įrašas nerastas.",
        },
      });
      return;
    }

    const asset = data as Pick<MediaAssetRow, "id" | "storage_path" | "external_url" | "asset_type">;

    if (asset.external_url) {
      res.json({
        data: {
          kind: "external",
          url: asset.external_url,
          expiresAt: null,
        },
        meta: {
          fetchedAt: new Date().toISOString(),
        },
      });
      return;
    }

    if (!asset.storage_path || isExternalStoragePath(asset.storage_path)) {
      throw new HttpError(400, "Šiam įrašui negalima sugeneruoti pasirašyto URL.", "INVALID_STORAGE_PATH");
    }

    const storageClient = getSupabaseClient({ service: true }) as any;
    const { data: signed, error: signedError } = await storageClient
      .storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(asset.storage_path, expiresIn ?? SIGNED_URL_DEFAULT_EXPIRY);

    if (signedError || !signed) {
      throw signedError ?? new HttpError(502, "Nepavyko sugeneruoti pasirašyto URL.", "SIGNED_URL_ERROR");
    }

    const expiresAt = new Date(Date.now() + (expiresIn ?? SIGNED_URL_DEFAULT_EXPIRY) * 1000).toISOString();

    res.json({
      data: {
        kind: "supabase-signed-url",
        url: signed.signedUrl,
        expiresAt,
      },
      meta: {
        fetchedAt: new Date().toISOString(),
      },
    });
  })
);

router.delete(
  "/:id",
  mediaDeleteRateLimiter,
  asyncHandler(async (req, res) => {
    const id = req.params.id?.trim();

    if (!id) {
      res.status(400).json({
        error: {
          code: "MEDIA_ID_REQUIRED",
          message: "Medijos ID privalomas.",
        },
      });
      return;
    }

    const supabase = getSupabaseClient({ service: true, schema: "burburiuok" }) as any;

    const { data: asset, error: fetchError } = await supabase
      .from("media_assets")
      .select(
        "id, concept_id, asset_type, storage_path, external_url, title, caption_lt, caption_en, created_by, created_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!asset) {
      res.status(404).json({
        error: {
          code: "MEDIA_NOT_FOUND",
          message: "Medijos įrašas nerastas.",
        },
      });
      return;
    }

    const { error: deleteError } = await supabase.from("media_assets").delete().eq("id", id);
    if (deleteError) {
      throw deleteError;
    }

    let storageStatus: "skipped" | "removed" | "missing" = "skipped";

    if (!asset.external_url && asset.storage_path && !isExternalStoragePath(asset.storage_path)) {
      const storageClient = getSupabaseClient({ service: true }) as any;
      const { error: removeError } = await storageClient
        .storage
        .from(MEDIA_BUCKET)
        .remove([asset.storage_path]);

      if (removeError) {
        storageStatus = "missing";
        // eslint-disable-next-line no-console
        console.warn("[media] storage_remove_failed", {
          assetId: id,
          storagePath: asset.storage_path,
          message: removeError.message,
        });
      } else {
        storageStatus = "removed";
      }
    }

    // eslint-disable-next-line no-console
    console.info("[media] asset_deleted", {
      assetId: id,
      conceptId: asset.concept_id,
      storageStatus,
    });

    res.json({
      data: {
        deletedId: id,
        storageStatus,
      },
      meta: {
        deletedAt: new Date().toISOString(),
      },
    });
  })
);

function sendValidationError(res: Response, fieldErrors: Record<string, string[] | undefined>): void {
  res.status(422).json({
    error: {
      code: "VALIDATION_ERROR",
      message: "Pateikti duomenys neatitinka reikalavimų.",
      fieldErrors,
    },
  });
}

function normalizeCursor(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new HttpError(400, "Netinkamas kursoriaus formatas.", "INVALID_CURSOR");
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    throw new HttpError(400, "Netinkamas kursoriaus formatas.", "INVALID_CURSOR");
  }
  return new Date(parsed).toISOString();
}

type UploadInstruction = {
  kind: "supabase-upload";
  bucketId: string;
  path: string;
  url: string;
  token: string;
  expiresAt: string;
  contentType: string;
};

async function ensureConceptExists(supabase: any, conceptId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("concepts")
    .select("id")
    .eq("id", conceptId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

function validateUploadPayload(payload: AdminMediaCreateInput): void {
  if (payload.source.kind !== "upload") {
    return;
  }

  const contentType = payload.source.contentType.toLowerCase();
  if (payload.assetType === "image") {
    if (!contentType.startsWith("image/")) {
      throw new HttpError(422, "Vaizdo įkelimui reikalingas image/* turinio tipas.", "UNSUPPORTED_MEDIA_TYPE");
    }
  } else if (payload.assetType === "video") {
    if (contentType !== "video/mp4") {
      throw new HttpError(422, "Vaizdo įrašams palaikomas tik video/mp4 formatas.", "UNSUPPORTED_MEDIA_TYPE");
    }
  }
}

function resolveUploadExtension(payload: AdminMediaCreateInput): string {
  if (payload.source.kind !== "upload") {
    return "";
  }

  const fileNameExtension = extname(payload.source.fileName).toLowerCase();
  const contentType = payload.source.contentType.toLowerCase();

  if (payload.assetType === "image") {
    if (IMAGE_EXTENSIONS.has(fileNameExtension)) {
      return normalizeExtension(fileNameExtension);
    }
    const mapped = CONTENT_TYPE_EXTENSION_MAP.get(contentType);
    if (mapped && IMAGE_EXTENSIONS.has(mapped)) {
      return normalizeExtension(mapped);
    }
  }

  if (payload.assetType === "video") {
    if (VIDEO_EXTENSIONS.has(fileNameExtension)) {
      return normalizeExtension(fileNameExtension);
    }
    const mapped = CONTENT_TYPE_EXTENSION_MAP.get(contentType);
    if (mapped && VIDEO_EXTENSIONS.has(mapped)) {
      return normalizeExtension(mapped);
    }
  }

  throw new HttpError(422, "Nepalaikomas failo formatas.", "UNSUPPORTED_MEDIA_TYPE");
}

function normalizeExtension(extension: string): string {
  if (extension === ".jpeg") {
    return ".jpg";
  }
  return extension;
}

function buildIlikePattern(raw: string): string | null {
  const sanitized = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[%_,.;:]/g, " ")
    .replace(/[\'\"`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) {
    return null;
  }

  const compact = sanitized
    .split(" ")
    .filter((token) => token.length)
    .join("%");

  if (!compact.length) {
    return null;
  }

  return `%${compact}%`;
}

function buildUploadStoragePath(conceptId: string, assetId: string, extension: string): string {
  return `concept/${conceptId}/${assetId}${extension}`;
}

async function createSignedUploadUrl(
  supabase: any,
  options: { storagePath: string; contentType: string }
): Promise<UploadInstruction> {
  const { data, error } = await supabase
    .storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(options.storagePath, UPLOAD_URL_EXPIRY_SECONDS, {
      contentType: options.contentType,
    });

  if (error || !data) {
    throw error ?? new HttpError(502, "Nepavyko sugeneruoti įkėlimo URL.", "UPLOAD_URL_ERROR");
  }

  const expiresAt = new Date(Date.now() + UPLOAD_URL_EXPIRY_SECONDS * 1000).toISOString();

  return {
    kind: "supabase-upload",
    bucketId: MEDIA_BUCKET,
    path: options.storagePath,
    url: data.signedUrl,
    token: data.token,
    expiresAt,
    contentType: options.contentType,
  };
}

function validateExternalUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    throw new HttpError(422, "Neteisingas URL formatas.", "INVALID_URL");
  }

  if (parsed.protocol !== "https:") {
    throw new HttpError(422, "Leidžiami tik HTTPS URL adresai.", "UNSUPPORTED_URL_PROTOCOL");
  }

  if (!ALLOWED_EXTERNAL_HOSTS.has(parsed.hostname)) {
    throw new HttpError(422, "Leidžiami tik patvirtinti leidėjai (YouTube, Vimeo).", "UNSUPPORTED_PROVIDER");
  }
}

function getPositiveIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export default router;
