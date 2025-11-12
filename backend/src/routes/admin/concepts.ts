import { Router } from "express";
import {
  listConcepts,
  getConceptBySlug,
  findConceptBySectionAndTerm,
  upsertConcepts,
} from "../../../../data/repositories/conceptsRepository.ts";
import { deleteCurriculumItemAdminBySlug } from "../../../../data/repositories/curriculumRepository.ts";
import { listContentVersionsForEntity } from "../../../../data/repositories/contentVersionsRepository.ts";
import type {
  Concept,
  ContentVersionStatus,
  CurriculumItem,
  UpsertConceptInput,
} from "../../../../data/types.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { unauthorized } from "../../utils/httpError.ts";
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

    const concepts = await listConcepts(null, options);

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

    const payload = validation.data;

    const existing = await getConceptBySlug(payload.slug);

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
};

function mapVersionForResponse(row: {
  id: string;
  status: ContentVersionStatus | null;
  change_summary: string | null;
  diff: unknown;
  created_at: string;
  created_by: string | null;
  version: number | null;
}): ConceptVersionResponse {
  return {
    id: row.id,
    status: row.status ?? null,
    changeSummary: row.change_summary,
    diff: row.diff ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
    version: row.version ?? null,
  } satisfies ConceptVersionResponse;
}
