import { Router } from "express";
import { listConcepts, getConceptBySlug } from "../../../data/repositories/conceptsRepository.ts";
import { listMediaAssetsByConceptSlug } from "../../../data/repositories/mediaAssetsRepository.ts";
import { getSupabaseClient } from "../../../data/supabaseClient.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";
import { HttpError, notFound } from "../utils/httpError.ts";
import {
  MEDIA_BUCKET,
  SIGNED_URL_DEFAULT_EXPIRY,
  mapMediaAssetForResponse,
  isExternalStoragePath,
} from "./media/shared.ts";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { sectionCode, nodeCode, requiredOnly } = req.query;
    const concepts = await listConcepts(undefined, {
      sectionCode: sectionCode ? String(sectionCode) : undefined,
      nodeCode: nodeCode ? String(nodeCode) : undefined,
      requiredOnly:
        typeof requiredOnly === "string"
          ? ["true", "1", "yes"].includes(requiredOnly.toLowerCase())
          : undefined,
    });

    res.json({
      data: concepts,
      meta: {
        fetchedAt: new Date().toISOString(),
        total: concepts.length,
      },
    });
  })
);

router.get(
  "/:slug/media",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug ?? "").trim();

    if (!slug) {
      res.status(400).json({
        error: {
          code: "SLUG_REQUIRED",
          message: "Temos identifikatorius privalomas.",
        },
      });
      return;
    }

    const concept = await getConceptBySlug(slug);

    if (!concept) {
      throw notFound(`Concept '${slug}' was not found.`);
    }

    const mediaRows = await listMediaAssetsByConceptSlug(slug);

    if (!mediaRows.length) {
      res.json({
        data: {
          conceptId: concept.id,
          items: [],
        },
        meta: {
          fetchedAt: new Date().toISOString(),
          expiresInSeconds: SIGNED_URL_DEFAULT_EXPIRY,
        },
      });
      return;
    }

    const storageClient = getSupabaseClient({ service: true }) as any;

    const items = await Promise.all(
      mediaRows.map(async (row) => {
        const mapped = mapMediaAssetForResponse(row);

        if (mapped.sourceKind === "external" && row.external_url) {
          return {
            id: mapped.id,
            assetType: mapped.assetType,
            sourceKind: mapped.sourceKind,
            title: mapped.title,
            captionLt: mapped.captionLt,
            captionEn: mapped.captionEn,
            url: row.external_url,
            expiresAt: null as string | null,
            createdAt: mapped.createdAt,
          };
        }

        if (!row.storage_path || isExternalStoragePath(row.storage_path)) {
          throw new HttpError(400, "Šiai medijai trūksta saugojimo kelio.", "MEDIA_STORAGE_MISSING");
        }

        const { data: signed, error } = await storageClient.storage
          .from(MEDIA_BUCKET)
          .createSignedUrl(row.storage_path, SIGNED_URL_DEFAULT_EXPIRY);

        if (error || !signed) {
          throw error ?? new HttpError(502, "Nepavyko sugeneruoti medijos nuorodos.", "SIGNED_URL_ERROR");
        }

        const expiresAt = new Date(Date.now() + SIGNED_URL_DEFAULT_EXPIRY * 1000).toISOString();

        return {
          id: mapped.id,
          assetType: mapped.assetType,
          sourceKind: mapped.sourceKind,
          title: mapped.title,
          captionLt: mapped.captionLt,
          captionEn: mapped.captionEn,
          url: signed.signedUrl,
          expiresAt,
          createdAt: mapped.createdAt,
        };
      })
    );

    res.json({
      data: {
        conceptId: concept.id,
        items,
      },
      meta: {
        fetchedAt: new Date().toISOString(),
        expiresInSeconds: SIGNED_URL_DEFAULT_EXPIRY,
      },
    });
  })
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const concept = await getConceptBySlug(slug);

    if (!concept) {
      throw notFound(`Concept '${slug}' was not found.`);
    }

    res.json({
      data: concept,
      meta: {
        fetchedAt: new Date().toISOString(),
      },
    });
  })
);

export default router;
