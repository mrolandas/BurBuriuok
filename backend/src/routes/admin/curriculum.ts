import { Router } from "express";
import {
  createCurriculumItemAdmin,
  createCurriculumNodeAdmin,
  deleteCurriculumNodeAdmin,
  getCurriculumNodeByCode,
  listAllCurriculumNodes,
  listCurriculumNodesByParent,
  updateCurriculumNodeAdmin,
  type CreateCurriculumNodeInput,
  type UpdateCurriculumNodeInput,
} from "../../../../data/repositories/curriculumRepository.ts";
import type {
  Concept,
  ContentVersionStatus,
  CurriculumItem,
  CurriculumNode,
} from "../../../../data/types.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { logContentMutation } from "../../services/auditLogger.ts";
import { unauthorized } from "../../utils/httpError.ts";
import {
  adminCurriculumItemCreateSchema,
  adminCurriculumNodeCreateSchema,
  adminCurriculumNodeUpdateSchema,
  type AdminCurriculumNodeCreateInput,
} from "../../../../shared/validation/adminCurriculumSchema.ts";
import {
  isSupabaseAuthError,
  isUniqueConstraintError,
} from "../../utils/supabaseErrors.ts";

const router = Router();

router.get(
  "/nodes",
  asyncHandler(async (req, res) => {
    if (req.query.view === "all") {
      const nodes = await listAllCurriculumNodes();
      res.json({
        data: {
          nodes: nodes.map(mapNodeForResponse),
        },
        meta: {
          count: nodes.length,
          fetchedAt: new Date().toISOString(),
        },
      });
      return;
    }

    const rawParent =
      typeof req.query.parentCode === "string" ? req.query.parentCode.trim() : null;
    const parentCode = rawParent && rawParent.length ? rawParent : null;

    const nodes = await listCurriculumNodesByParent(parentCode);

    res.json({
      data: {
        nodes: nodes.map(mapNodeForResponse),
      },
      meta: {
        count: nodes.length,
        fetchedAt: new Date().toISOString(),
      },
    });
  })
);

router.post(
  "/nodes",
  asyncHandler(async (req, res) => {
    const validation = adminCurriculumNodeCreateSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: {
          message: "Neteisingai užpildyta poskyrio forma.",
          details: validation.error.flatten(),
        },
      });
      return;
    }

  const payload = normalizeCreatePayload(validation.data);

    let created: CurriculumNode | null = null;

    try {
      created = await createCurriculumNodeAdmin(payload);
    } catch (error) {
      if (isSupabaseAuthError(error)) {
        throw unauthorized(
          "Supabase service role key rejected by database. Update SUPABASE_SERVICE_ROLE_KEY and restart the backend."
        );
      }

      if (isUniqueConstraintError(error)) {
        res.status(409).json({
          error: {
            message: `Curriculum node '${payload.code ?? "(automatinis kodas)"}' jau egzistuoja.`,
          },
        });
        return;
      }

      if (typeof (error as { code?: string }).code === "string") {
        const code = String((error as { code: string }).code);
        if (code === "PARENT_NOT_FOUND") {
          res.status(404).json({
            error: {
              message: `Parent node '${payload.parentCode ?? "(root)"}' was not found.`,
            },
          });
          return;
        }
      }

      throw error;
    }

    if (!created) {
      throw new Error("Curriculum node creation did not return a result.");
    }

    try {
      await logContentMutation({
        entityType: "curriculum_node",
        entityId: created.code,
        before: null,
        after: mapNodeForResponse(created),
        actor: req.authUser?.email ?? req.authUser?.id ?? null,
        changeSummary: `Curriculum node '${created.code}' created via admin console.`,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to log curriculum node creation", {
        code: created.code,
        error,
      });
    }

    res.status(201).json({
      data: {
        node: mapNodeForResponse(created),
      },
      meta: {
        createdAt: new Date().toISOString(),
      },
    });
  })
);

const handleUpdateCurriculumNode = async (req: any, res: any) => {
  const { code } = req.params;
  const validation = adminCurriculumNodeUpdateSchema.safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({
      error: {
        message: "Neteisingai užpildyta poskyrio forma.",
        details: validation.error.flatten(),
      },
    });
    return;
  }

  const existing = await getCurriculumNodeByCode(code);

  if (!existing) {
    res.status(404).json({
      error: {
        message: `Curriculum node '${code}' was not found.`,
      },
    });
    return;
  }

  if (
    typeof validation.data.parentCode !== "undefined" &&
    validation.data.parentCode !== existing.parentCode
  ) {
    res.status(400).json({
      error: {
        message: "Perkėlimas į kitą tėvinį poskyrį dar nepalaikomas.",
      },
    });
    return;
  }

  const payload: UpdateCurriculumNodeInput = {
    title: typeof validation.data.title === "string" ? validation.data.title : undefined,
    summary:
      typeof validation.data.summary !== "undefined"
        ? validation.data.summary ?? null
        : undefined,
    ordinal:
      typeof validation.data.ordinal === "number"
        ? Number(validation.data.ordinal)
        : undefined,
  };

  let updated: CurriculumNode | null = null;

  try {
    updated = await updateCurriculumNodeAdmin(code, payload);
  } catch (error) {
    if (isSupabaseAuthError(error)) {
      throw unauthorized(
        "Supabase service role key rejected by database. Update SUPABASE_SERVICE_ROLE_KEY and restart the backend."
      );
    }

    if (isUniqueConstraintError(error)) {
      res.status(409).json({
        error: {
          message:
            "Nepavyko išsaugoti poskyrio, nes kitas to paties lygio elementas jau turi pasirinktą eilės numerį.",
        },
      });
      return;
    }

    throw error;
  }

  if (!updated) {
    throw new Error(`Curriculum node '${code}' was not returned after update.`);
  }

  try {
    await logContentMutation({
      entityType: "curriculum_node",
      entityId: updated.code,
      before: mapNodeForResponse(existing),
      after: mapNodeForResponse(updated),
      actor: req.authUser?.email ?? req.authUser?.id ?? null,
      changeSummary: `Curriculum node '${updated.code}' updated via admin console.`,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to log curriculum node update", {
      code,
      error,
    });
  }

  res.json({
    data: {
      node: mapNodeForResponse(updated),
    },
    meta: {
      updatedAt: new Date().toISOString(),
    },
  });
};

router.patch("/nodes/:code", asyncHandler(handleUpdateCurriculumNode));
router.put("/nodes/:code", asyncHandler(handleUpdateCurriculumNode));

router.delete(
  "/nodes/:code",
  asyncHandler(async (req, res) => {
    const { code } = req.params;

    const existing = await getCurriculumNodeByCode(code);

    if (!existing) {
      res.status(404).json({
        error: {
          message: `Curriculum node '${code}' was not found.`,
        },
      });
      return;
    }

    let removed: CurriculumNode | null = null;

    try {
      removed = await deleteCurriculumNodeAdmin(code);
    } catch (error) {
      if (isSupabaseAuthError(error)) {
        throw unauthorized(
          "Supabase service role key rejected by database. Update SUPABASE_SERVICE_ROLE_KEY and restart the backend."
        );
      }

      throw error;
    }

    if (!removed) {
      throw new Error(`Curriculum node '${code}' was not returned after deletion.`);
    }

    try {
      const beforeForLog = mapNodeForResponse(existing);
      await logContentMutation<Record<string, unknown>>({
        entityType: "curriculum_node",
        entityId: removed.code,
        before: beforeForLog,
        after: {},
        actor: req.authUser?.email ?? req.authUser?.id ?? null,
        changeSummary: `Curriculum node '${removed.code}' deleted via admin console.`,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to log curriculum node deletion", {
        code,
        error,
      });
    }

    res.json({
      data: {
        node: mapNodeForResponse(removed),
      },
      meta: {
        deletedAt: new Date().toISOString(),
      },
    });
  })
);

router.post(
  "/items",
  asyncHandler(async (req, res) => {
    const validation = adminCurriculumItemCreateSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: {
          message: "Neteisingai užpildyta sąvokos forma.",
          details: validation.error.flatten(),
        },
      });
      return;
    }

    let created: Awaited<ReturnType<typeof createCurriculumItemAdmin>> | null = null;

    try {
      created = await createCurriculumItemAdmin(validation.data);
    } catch (error) {
      if (isSupabaseAuthError(error)) {
        throw unauthorized(
          "Supabase service role key rejected by database. Update SUPABASE_SERVICE_ROLE_KEY and restart the backend."
        );
      }

      if ((error as { code?: string }).code === "CONCEPT_ALREADY_EXISTS") {
        const concept = (error as { concept?: Concept }).concept ?? null;
        res.status(409).json({
          error: {
            message: concept
              ? `Šiame skyriuje jau yra sąvoka „${concept.termLt}“.`
              : "Šiame skyriuje jau yra tokia sąvoka.",
            code: "CONCEPT_ALREADY_EXISTS",
            details: concept
              ? {
                  slug: concept.slug,
                  termLt: concept.termLt,
                  nodeCode: concept.curriculumNodeCode,
                  itemLabel: concept.curriculumItemLabel,
                }
              : undefined,
          },
        });
        return;
      }

      if (isUniqueConstraintError(error)) {
        res.status(409).json({
          error: {
            message: "Šiame skyriuje jau yra tokia sąvoka.",
          },
        });
        return;
      }

      if (error instanceof Error && error.message === "Curriculum item label cannot be empty.") {
        res.status(400).json({
          error: {
            message: "Sąvoka negali būti tuščia.",
          },
        });
        return;
      }

      if (typeof (error as { code?: string }).code === "string") {
        const codeValue = String((error as { code: string }).code);
        if (codeValue === "NODE_NOT_FOUND") {
          res.status(404).json({
            error: {
              message: `Curriculum node '${validation.data.nodeCode}' was not found.`,
            },
          });
          return;
        }
      }

      throw error;
    }

    if (!created) {
      throw new Error("Curriculum item creation did not return a result.");
    }

    const actor = req.authUser?.email ?? req.authUser?.id ?? null;

    const conceptStatus = resolveConceptStatus(created.concept);

    try {
      await logContentMutation({
        entityType: "curriculum_item",
        entityId: `${created.item.nodeCode}:${created.item.ordinal}`,
        before: null,
        after: mapItemForLog(created.item, created.concept),
        actor,
        changeSummary: `Curriculum item '${created.item.label}' created via admin console.`,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to log curriculum item creation", {
        nodeCode: created.item.nodeCode,
        ordinal: created.item.ordinal,
        error,
      });
    }

    try {
      await logContentMutation({
        entityType: "concept",
        entityId: created.concept.slug,
        before: null,
        after: mapConceptForLog(created.concept),
        actor,
        status: conceptStatus,
        changeSummary: `Concept '${created.concept.slug}' created for curriculum item '${created.item.nodeCode}'.`,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to log concept creation for curriculum item", {
        slug: created.concept.slug,
        error,
      });
    }

    res.status(201).json({
      data: {
        item: mapItemForResponse(created.item, created.concept),
      },
      meta: {
        createdAt: new Date().toISOString(),
      },
    });
  })
);

export default router;

function normalizeCreatePayload(
  payload: AdminCurriculumNodeCreateInput
): CreateCurriculumNodeInput {
  const code =
    typeof payload.code === "string" && payload.code.trim().length
      ? payload.code.trim()
      : null;
  const title = payload.title.trim();
  const parentCode = payload.parentCode ? payload.parentCode.trim() : null;

  const summaryValue =
    typeof payload.summary === "string" ? payload.summary.trim() : payload.summary ?? null;
  const summary = summaryValue && summaryValue.length ? summaryValue : null;

  const ordinal =
    typeof payload.ordinal === "number" && Number.isFinite(payload.ordinal)
      ? Number(payload.ordinal)
      : null;

  return {
    code,
    title,
    summary,
    parentCode,
    ordinal,
  } satisfies CreateCurriculumNodeInput;
}

type CurriculumNodeResponse = {
  code: string;
  title: string;
  summary: string | null;
  level: number;
  parentCode: string | null;
  ordinal: number;
  createdAt: string;
  updatedAt: string;
  prerequisiteCount: number;
};

type CurriculumItemResponse = {
  nodeCode: string;
  ordinal: number;
  label: string;
  conceptSlug: string;
  conceptTerm: string;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

function resolveConceptStatus(concept: Concept): ContentVersionStatus {
  const raw = typeof concept.metadata?.status === "string" ? concept.metadata.status : null;
  const allowed: ContentVersionStatus[] = ["draft", "in_review", "published", "archived"];
  if (raw && allowed.includes(raw as ContentVersionStatus)) {
    return raw as ContentVersionStatus;
  }
  return "draft";
}

function mapItemForResponse(item: CurriculumItem, concept: Concept): CurriculumItemResponse {
  return {
    nodeCode: item.nodeCode,
    ordinal: item.ordinal,
    label: item.label,
    conceptSlug: concept.slug,
    conceptTerm: concept.termLt,
    isRequired: concept.isRequired,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  } satisfies CurriculumItemResponse;
}

function mapItemForLog(item: CurriculumItem, concept: Concept) {
  return {
    nodeCode: item.nodeCode,
    ordinal: item.ordinal,
    label: item.label,
    conceptSlug: concept.slug,
    conceptTerm: concept.termLt,
    isRequired: concept.isRequired,
  } satisfies Record<string, unknown>;
}

function mapConceptForLog(concept: Concept) {
  return {
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
  } satisfies Record<string, unknown>;
}

function mapNodeForResponse(node: CurriculumNode): CurriculumNodeResponse {
  return {
    code: node.code,
    title: node.title,
    summary: node.summary,
    level: node.level,
    parentCode: node.parentCode,
    ordinal: node.ordinal,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    prerequisiteCount: 0,
  } satisfies CurriculumNodeResponse;
}
