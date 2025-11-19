import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listConcepts,
  getConceptBySlug,
  findConceptBySectionAndTerm,
  upsertConcepts,
} from "../../../../data/repositories/conceptsRepository.ts";
import { deleteCurriculumItemAdminBySlug } from "../../../../data/repositories/curriculumRepository.ts";
import { getSupabaseClient } from "../../../../data/supabaseClient.ts";
import {
  getContentVersionById,
  listContentVersionsForEntity,
  type ContentVersionDbRow,
} from "../../../../data/repositories/contentVersionsRepository.ts";
import type {
  Concept,
  ContentVersionStatus,
  CurriculumItem,
  UpsertConceptInput,
} from "../../../../data/types.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { HttpError, unauthorized } from "../../utils/httpError.ts";
import { logContentMutation } from "../../services/auditLogger.ts";
import {
  adminConceptMutationSchema,
  adminConceptStatusSchema,
  type AdminConceptMutationInput,
} from "../../../../shared/validation/adminConceptSchema.ts";
import { isSupabaseAuthError, isUniqueConstraintError } from "../../utils/supabaseErrors.ts";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const sectionCode =
      typeof req.query.sectionCode === "string"
        ? req.query.sectionCode.trim()
        : undefined;

    const statusQuery =
      typeof req.query.status === "string"
        ? req.query.status.trim().toLowerCase()
        : undefined;

    const options: { sectionCode?: string } = {};

    if (sectionCode) {
      options.sectionCode = sectionCode;
    }

    let adminClient: SupabaseClient | null = null;

    try {
      adminClient = getSupabaseClient({ service: true, schema: "burburiuok" });
    } catch (error) {
      console.warn(
        "[AdminConcepts] Falling back to public schema client – service key missing or invalid.",
        error instanceof Error ? error.message : error
      );
    }

    const concepts = await listConcepts(adminClient ?? null, options);

    const statusFilter = statusQuery
      ? adminConceptStatusSchema.safeParse(statusQuery)
      : null;

    const filteredConcepts =
      statusFilter && statusFilter.success
        ? concepts.filter((concept) => extractStatus(concept) === statusFilter.data)
        : concepts;

    res.json({
      data: {
        concepts: filteredConcepts.map(mapConceptForResponse),
      },
      meta: {
        count: filteredConcepts.length,
        fetchedAt: new Date().toISOString(),
      },
    });
  })
);

router.get(
  "/:slug/history",
  asyncHandler(async (req, res) => {
    const slug = req.params.slug?.trim();

    if (!slug) {
      res.status(400).json({
        error: {
          message: "Slug parameter is required.",
        },
      });
      return;
    }

    const limitParam =
      typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
    const limit = Number.isFinite(limitParam) && limitParam ? Math.min(Math.max(limitParam, 1), 50) : 20;

    const versions = await listContentVersionsForEntity("concept", slug, limit);

    res.json({
      data: {
        versions: versions.map(mapVersionForResponse),
      },
      meta: {
        count: versions.length,
        fetchedAt: new Date().toISOString(),
      },
    });
  })
);

router.post(
  "/:slug/rollback",
  asyncHandler(async (req, res) => {
    const slug = req.params.slug?.trim();

    if (!slug) {
      res.status(400).json({
        error: {
          message: "Slug parameter is required.",
          code: "SLUG_REQUIRED",
        },
      });
      return;
    }

    const versionId =
      typeof req.body?.versionId === "string" ? req.body.versionId.trim() : "";

    if (!versionId) {
      res.status(400).json({
        error: {
          message: "versionId body parameter is required.",
          code: "VERSION_ID_REQUIRED",
        },
      });
      return;
    }

    const actor = req.authUser?.email ?? req.authUser?.id ?? null;

    try {
      const result = await rollbackConceptVersion({
        slug,
        versionId,
        actor,
      });

      res.json({
        data: {
          concept: mapConceptForResponse(result.concept),
        },
        meta: {
          rollbackAt: new Date().toISOString(),
          rolledBackToVersionId: versionId,
          version: result.versionNumber,
        },
      });
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({
          error: {
            message: error.message,
            code: error.code,
          },
        });
        return;
      }

      throw error;
    }
  })
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const slug = req.params.slug?.trim();

    if (!slug) {
      res.status(400).json({
        error: {
          message: "Slug parameter is required.",
        },
      });
      return;
    }

    const concept = await getConceptBySlug(slug);

    if (!concept) {
      res.status(404).json({
        error: {
          message: `Concept with slug '${slug}' was not found.`,
        },
      });
      return;
    }

    res.json({
      data: {
        concept: mapConceptForResponse(concept),
      },
      meta: {
        fetchedAt: new Date().toISOString(),
      },
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const validation = adminConceptMutationSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: {
          message: "Invalid concept payload.",
          details: validation.error.flatten(),
        },
      });
      return;
    }

  let payload = validation.data;

  const existing = await getConceptBySlug(payload.slug);

  const supabase = getSupabaseClient({ service: true, schema: "burburiuok" });
  payload = await prepareCurriculumFields(payload, existing ?? null, supabase);

    const isEditingExisting = Boolean(existing && payload.originalSlug === existing.slug);

    if (!isEditingExisting && existing) {
      const conflictConcept = mapConceptForResponse(existing);
      res.status(409).json({
        error: {
          message: `Slug '${payload.slug}' jau naudojamas kitai sąvokai.`,
          code: "CONCEPT_ALREADY_EXISTS",
          details: {
            slug: conflictConcept.slug,
            termLt: conflictConcept.termLt,
            nodeCode: conflictConcept.curriculumNodeCode,
            itemLabel: conflictConcept.curriculumItemLabel,
          },
        },
      });
      return;
    }

    const conflictingByTerm = await findConceptBySectionAndTerm(
      payload.sectionCode,
      payload.termLt
    );

    if (
      conflictingByTerm &&
      conflictingByTerm.slug !== payload.slug &&
      conflictingByTerm.slug !== payload.originalSlug
    ) {
      res.status(409).json({
        error: {
          message: `Šiame skyriuje jau yra sąvoka "${conflictingByTerm.termLt}".`,
          code: "CONCEPT_ALREADY_EXISTS",
          details: {
            slug: conflictingByTerm.slug,
            termLt: conflictingByTerm.termLt,
            nodeCode: conflictingByTerm.curriculumNodeCode,
            itemLabel: conflictingByTerm.curriculumItemLabel,
          },
        },
      });
      return;
    }

    const upsertPayload = toUpsertConceptInput(payload, existing?.metadata ?? {});

    try {
      await upsertConcepts([upsertPayload]);
      await syncCurriculumItemRecord(payload, existing ?? null, supabase);
    } catch (error) {
      if (isSupabaseAuthError(error)) {
        throw unauthorized(
          "Supabase service role key rejected by database. Update SUPABASE_SERVICE_ROLE_KEY and restart the backend."
        );
      }
      if (isUniqueConstraintError(error)) {
        const conflict = await findConceptBySectionAndTerm(
          payload.sectionCode,
          payload.termLt
        );

        res.status(409).json({
          error: {
            message: conflict
              ? `Šiame skyriuje jau yra sąvoka „${conflict.termLt}“.`
              : "Šiame skyriuje jau yra tokia sąvoka.",
            code: "CONCEPT_ALREADY_EXISTS",
            details: conflict
              ? {
                  slug: conflict.slug,
                  termLt: conflict.termLt,
                  nodeCode: conflict.curriculumNodeCode,
                  itemLabel: conflict.curriculumItemLabel,
                }
              : undefined,
          },
        });
        return;
      }
      throw error;
    }

    const updated = await getConceptBySlug(payload.slug);

    if (!updated) {
      throw new Error(
        `Concept '${payload.slug}' could not be reloaded after upsert.`
      );
    }

    try {
      await logContentMutation({
        entityType: "concept",
        entityId: payload.slug,
        before: existing ? mapConceptForResponse(existing) : null,
        after: mapConceptForResponse(updated),
        actor: req.authUser?.email ?? req.authUser?.id ?? null,
        status: payload.status,
        changeSummary: existing
          ? `Concept '${payload.slug}' updated via admin console.`
          : `Concept '${payload.slug}' created via admin console.`,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to log concept mutation", {
        slug: payload.slug,
        error,
      });
    }

    res.status(existing ? 200 : 201).json({
      data: {
        concept: mapConceptForResponse(updated),
      },
      meta: {
        savedAt: new Date().toISOString(),
      },
    });
  })
);

router.delete(
  "/:slug",
  asyncHandler(async (req, res) => {
    const slug = req.params.slug?.trim();

    if (!slug) {
      res.status(400).json({
        error: {
          message: "Slug parameter is required.",
        },
      });
      return;
    }

    let deletion: Awaited<ReturnType<typeof deleteCurriculumItemAdminBySlug>>;

    try {
      deletion = await deleteCurriculumItemAdminBySlug(slug);
    } catch (error) {
      if ((error as { code?: string }).code === "CONCEPT_NOT_FOUND") {
        res.status(404).json({
          error: {
            message: `Concept with slug '${slug}' was not found.`,
          },
        });
        return;
      }

      throw error;
    }

    const { concept, item } = deletion;
    const actor = req.authUser?.email ?? req.authUser?.id ?? null;

    try {
      await logContentMutation<Record<string, unknown>>({
        entityType: "concept",
        entityId: concept.slug,
        before: mapConceptForResponse(concept),
        after: {},
        actor,
        status: extractStatus(concept),
        changeSummary: `Concept '${concept.slug}' deleted via admin console.`,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to log concept deletion", {
        slug: concept.slug,
        error,
      });
    }

    if (item) {
      try {
        await logContentMutation<Record<string, unknown>>({
          entityType: "curriculum_item",
          entityId: `${item.nodeCode}:${item.ordinal}`,
          before: mapCurriculumItemForLog(item, concept),
          after: {},
          actor,
          changeSummary: `Curriculum item '${item.nodeCode}:${item.ordinal}' deleted via admin console.`,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to log curriculum item deletion", {
          nodeCode: item.nodeCode,
          ordinal: item.ordinal,
          error,
        });
      }
    }

    res.json({
      data: {
        concept: mapConceptForResponse(concept),
        item: item ? mapCurriculumItemForResponse(item) : null,
      },
      meta: {
        deletedAt: new Date().toISOString(),
      },
    });
  })
);

export default router;

type ConceptStatus = "draft" | "published";

function extractStatus(concept: Concept): ConceptStatus {
  const raw = concept.metadata?.status;
  if (typeof raw === "string" && raw === "published") {
    return "published";
  }
  return "draft";
}

function mapConceptForResponse(concept: Concept) {
  return {
    id: concept.id,
    slug: concept.slug,
    termLt: concept.termLt,
    termEn: concept.termEn,
    descriptionLt: concept.descriptionLt,
    descriptionEn: concept.descriptionEn,
    sectionCode: concept.sectionCode,
    sectionTitle: concept.sectionTitle,
    subsectionCode: concept.subsectionCode,
    subsectionTitle: concept.subsectionTitle,
    curriculumNodeCode: concept.curriculumNodeCode,
    curriculumItemOrdinal: concept.curriculumItemOrdinal,
    curriculumItemLabel: concept.curriculumItemLabel,
    sourceRef: concept.sourceRef,
    isRequired: concept.isRequired,
    metadata: concept.metadata ?? {},
    status: extractStatus(concept),
    createdAt: concept.createdAt,
    updatedAt: concept.updatedAt,
  } satisfies Record<string, unknown>;
}

function mapCurriculumItemForResponse(item: CurriculumItem) {
  return {
    nodeCode: item.nodeCode,
    ordinal: item.ordinal,
    label: item.label,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  } satisfies Record<string, unknown>;
}

function mapCurriculumItemForLog(item: CurriculumItem, concept: Concept) {
  return {
    nodeCode: item.nodeCode,
    ordinal: item.ordinal,
    label: item.label,
    conceptSlug: concept.slug,
    conceptTerm: concept.termLt,
    isRequired: concept.isRequired,
  } satisfies Record<string, unknown>;
}

async function prepareCurriculumFields(
  payload: AdminConceptMutationInput,
  existing: Concept | null,
  client: SupabaseClient
): Promise<AdminConceptMutationInput> {
  const result: AdminConceptMutationInput = {
    ...payload,
  };

  const hadExistingLink = Boolean(
    existing?.curriculumNodeCode && existing.curriculumItemOrdinal !== null
  );

  if (!result.curriculumNodeCode) {
    const canDerive = !hadExistingLink;
    if (canDerive) {
      const fallbackNode = result.subsectionCode ?? result.sectionCode ?? null;
      if (fallbackNode) {
        result.curriculumNodeCode = fallbackNode;
      }
    }
  }

  if (!result.curriculumNodeCode) {
    result.curriculumItemOrdinal = null;
    result.curriculumItemLabel = null;
    return result;
  }

  const labelSource = (result.curriculumItemLabel ?? result.termLt).trim();
  result.curriculumItemLabel = labelSource;

  if (result.curriculumItemOrdinal === null || Number.isNaN(result.curriculumItemOrdinal)) {
    result.curriculumItemOrdinal = await fetchNextCurriculumOrdinal(
      client,
      result.curriculumNodeCode
    );
  }

  return result;
}

type RollbackConceptParams = {
  slug: string;
  versionId: string;
  actor: string | null;
};

async function rollbackConceptVersion(
  params: RollbackConceptParams
): Promise<{ concept: Concept; versionNumber: number | null }> {
  const supabase = getSupabaseClient({ service: true, schema: "burburiuok" });

  const version = await getContentVersionById(params.versionId, supabase);

  if (!version) {
    throw new HttpError(404, `Version '${params.versionId}' was not found.`, "VERSION_NOT_FOUND");
  }

  if (version.entity_type !== "concept") {
    throw new HttpError(
      400,
      `Version '${params.versionId}' does not describe a concept entry and cannot be rolled back via this endpoint.`,
      "VERSION_UNSUPPORTED_ENTITY"
    );
  }

  if (version.entity_primary_key !== params.slug) {
    throw new HttpError(
      400,
      `Version '${params.versionId}' does not belong to concept '${params.slug}'.`,
      "VERSION_ENTITY_MISMATCH"
    );
  }

  const payload = snapshotToAdminPayload(version);
  const existing = await getConceptBySlug(params.slug, supabase);
  const prepared = await prepareCurriculumFields(payload, existing ?? null, supabase);

  const upsertPayload = toUpsertConceptInput(prepared, {});
  await upsertConcepts([upsertPayload], supabase);
  await syncCurriculumItemRecord(prepared, existing ?? null, supabase);

  const refreshed = await getConceptBySlug(params.slug, supabase);

  if (!refreshed) {
    throw new Error(`Concept '${params.slug}' could not be reloaded after rollback.`);
  }

  await logContentMutation({
    entityType: "concept",
    entityId: params.slug,
    before: existing ? mapConceptForResponse(existing) : null,
    after: mapConceptForResponse(refreshed),
    actor: params.actor ?? null,
    status: prepared.status,
    changeSummary: `Concept '${params.slug}' rolled back to version ${version.version ?? "?"}.`,
  });

  return {
    concept: refreshed,
    versionNumber: version.version ?? null,
  };
}

function snapshotToAdminPayload(version: ContentVersionDbRow): AdminConceptMutationInput {
  if (!isPlainObject(version.snapshot) || !Object.keys(version.snapshot as Record<string, unknown>).length) {
    throw new HttpError(
      409,
      "Selected version does not contain snapshot data required for rollback.",
      "VERSION_MISSING_SNAPSHOT"
    );
  }

  const raw = version.snapshot as Record<string, unknown>;
  const slug = readRequiredString(raw, "slug");
  const termLt = readRequiredString(raw, "termLt");
  const descriptionLt = readRequiredString(raw, "descriptionLt");
  const sectionCode = readRequiredString(raw, "sectionCode");
  const statusCandidate =
    (typeof raw.status === "string" ? raw.status : null) ?? version.status ?? "draft";
  const statusParse = adminConceptStatusSchema.safeParse(statusCandidate);

  if (!statusParse.success) {
    throw new HttpError(
      409,
      `Snapshot status '${String(statusCandidate)}' is not supported for rollback.`,
      "VERSION_INVALID_STATUS"
    );
  }

  const status = statusParse.data;
  const sectionTitle = readOptionalString(raw, "sectionTitle") ?? sectionCode;
  const metadata = cloneSnapshotMetadata(raw.metadata);
  metadata.status = status;

  const candidate = {
    slug,
    originalSlug: slug,
    termLt,
    termEn: readOptionalString(raw, "termEn"),
    descriptionLt,
    descriptionEn: readOptionalString(raw, "descriptionEn"),
    sectionCode,
    sectionTitle,
    subsectionCode: readOptionalString(raw, "subsectionCode"),
    subsectionTitle: readOptionalString(raw, "subsectionTitle"),
    curriculumNodeCode: readOptionalString(raw, "curriculumNodeCode"),
    curriculumItemOrdinal: readOptionalNumber(raw, "curriculumItemOrdinal"),
    curriculumItemLabel: readOptionalString(raw, "curriculumItemLabel") ?? termLt,
    sourceRef: readOptionalString(raw, "sourceRef"),
    isRequired: typeof raw.isRequired === "boolean" ? raw.isRequired : true,
    metadata,
    status,
  } satisfies Partial<AdminConceptMutationInput>;

  const validation = adminConceptMutationSchema.safeParse(candidate);

  if (!validation.success) {
    throw new HttpError(
      409,
      "Snapshot data is incomplete or malformed for rollback.",
      "VERSION_SNAPSHOT_INVALID"
    );
  }

  return validation.data;
}

function readRequiredString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length) {
      return trimmed;
    }
  }
  throw new HttpError(409, `Snapshot is missing required field '${key}'.`, "VERSION_SNAPSHOT_MISSING_FIELD");
}

function readOptionalString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function readOptionalNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function cloneSnapshotMetadata(source: unknown): Record<string, unknown> {
  if (!isPlainObject(source)) {
    return {};
  }

  try {
    return structuredClone(source as Record<string, unknown>);
  } catch (error) {
    try {
      return JSON.parse(JSON.stringify(source)) as Record<string, unknown>;
    } catch {
      return { ...((source as Record<string, unknown>) ?? {}) };
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fetchNextCurriculumOrdinal(client: SupabaseClient, nodeCode: string): Promise<number> {
  const { data, error } = await (client as any)
    .from("curriculum_items")
    .select("ordinal")
    .eq("node_code", nodeCode)
    .order("ordinal", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch next ordinal for '${nodeCode}': ${error.message}`);
  }

  const latest = Array.isArray(data) && data.length ? data[0]?.ordinal : null;
  const parsed =
    typeof latest === "number"
      ? latest
      : typeof latest === "string"
      ? Number.parseInt(latest, 10)
      : 0;

  return Number.isFinite(parsed) && parsed >= 1 ? parsed + 1 : 1;
}

async function syncCurriculumItemRecord(
  payload: AdminConceptMutationInput,
  existing: Concept | null,
  client: SupabaseClient
): Promise<void> {
  const newNodeCode = payload.curriculumNodeCode ?? null;
  const newOrdinal =
    typeof payload.curriculumItemOrdinal === "number" ? payload.curriculumItemOrdinal : null;
  const oldNodeCode = existing?.curriculumNodeCode ?? null;
  const oldOrdinal =
    typeof existing?.curriculumItemOrdinal === "number"
      ? existing.curriculumItemOrdinal
      : null;

  const moved =
    oldNodeCode && oldOrdinal !== null && (oldNodeCode !== newNodeCode || oldOrdinal !== newOrdinal);

  if (!newNodeCode || newOrdinal === null) {
    if (moved || (oldNodeCode && oldOrdinal !== null && !newNodeCode)) {
      await deleteCurriculumItemRecord(client, oldNodeCode, oldOrdinal);
    }
    return;
  }

  const label = (payload.curriculumItemLabel ?? payload.termLt).trim();
  await upsertCurriculumItemRecord(client, newNodeCode, newOrdinal, label);

  if (moved) {
    await deleteCurriculumItemRecord(client, oldNodeCode!, oldOrdinal!);
  }
}

async function upsertCurriculumItemRecord(
  client: SupabaseClient,
  nodeCode: string,
  ordinal: number,
  label: string
): Promise<void> {
  const { error } = await (client as any)
    .from("curriculum_items")
    .upsert(
      {
        node_code: nodeCode,
        ordinal,
        label,
      },
      { onConflict: "node_code,ordinal" }
    );

  if (error) {
    throw new Error(
      `Failed to upsert curriculum item '${nodeCode}:${ordinal}' with label '${label}': ${error.message}`
    );
  }
}

async function deleteCurriculumItemRecord(
  client: SupabaseClient,
  nodeCode: string,
  ordinal: number
): Promise<void> {
  const { error } = await (client as any)
    .from("curriculum_items")
    .delete()
    .eq("node_code", nodeCode)
    .eq("ordinal", ordinal);

  if (error) {
    throw new Error(
      `Failed to delete curriculum item '${nodeCode}:${ordinal}': ${error.message}`
    );
  }
}

function toUpsertConceptInput(
  payload: AdminConceptMutationInput,
  existingMetadata: Record<string, unknown>
): UpsertConceptInput {
  const metadata = {
    ...existingMetadata,
    ...(payload.metadata ?? {}),
    status: payload.status,
  } as Record<string, unknown>;

  return {
    section_code: payload.sectionCode,
    section_title: payload.sectionTitle,
    subsection_code: payload.subsectionCode ?? null,
    subsection_title: payload.subsectionTitle ?? null,
    slug: payload.slug,
    term_lt: payload.termLt,
    term_en: payload.termEn ?? null,
    description_lt: payload.descriptionLt,
    description_en: payload.descriptionEn ?? null,
    source_ref: payload.sourceRef ?? null,
    metadata,
    is_required: payload.isRequired,
    curriculum_node_code: payload.curriculumNodeCode ?? null,
    curriculum_item_ordinal: payload.curriculumItemOrdinal ?? null,
    curriculum_item_label: payload.curriculumItemLabel ?? null,
  } satisfies UpsertConceptInput;
}

type ConceptVersionResponse = {
  id: string;
  status: ContentVersionStatus | null;
  changeSummary: string | null;
  diff: unknown;
  createdAt: string;
  createdBy: string | null;
  version: number | null;
  hasSnapshot: boolean;
};

function mapVersionForResponse(row: ContentVersionDbRow): ConceptVersionResponse {
  return {
    id: row.id,
    status: row.status ?? null,
    changeSummary: row.change_summary,
    diff: row.diff ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
    version: row.version ?? null,
    hasSnapshot:
      isPlainObject(row.snapshot) && Object.keys(row.snapshot as Record<string, unknown>).length > 0,
  } satisfies ConceptVersionResponse;
}
