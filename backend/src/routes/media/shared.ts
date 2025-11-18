import type { Request } from "express";
import type { MediaAssetRow } from "../../../../data/types.ts";
export type { MediaAssetRow };

export const MEDIA_BUCKET = "media-admin";
export const SIGNED_URL_DEFAULT_EXPIRY = 3600;
export const UPLOAD_URL_EXPIRY_SECONDS = 300;

export type MediaAssetResponse = ReturnType<typeof mapMediaAssetForResponse>;

export function mapMediaAssetForResponse(row: MediaAssetRow) {
  return {
    id: row.id,
    conceptId: row.concept_id,
    assetType: row.asset_type,
    storagePath: row.storage_path,
    externalUrl: row.external_url,
    sourceKind: row.external_url ? "external" : "upload",
    title: row.title,
    captionLt: row.caption_lt,
    captionEn: row.caption_en,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
  };
}

export function isExternalStoragePath(storagePath: string): boolean {
  return storagePath.startsWith("external://");
}

export function buildExternalStoragePath(assetId: string): string {
  return `external://${assetId}`;
}

export function extractAdminIdentifier(req: Request): string | null {
  if (req.authUser?.id) {
    return req.authUser.id;
  }
  if (req.authUser?.email) {
    return req.authUser.email;
  }
  return req.ip ?? null;
}
