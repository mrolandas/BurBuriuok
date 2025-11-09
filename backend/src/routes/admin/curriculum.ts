import { Router } from "express";
import {
  createCurriculumNodeAdmin,
  listCurriculumNodesByParent,
  type CreateCurriculumNodeInput,
} from "../../../../data/repositories/curriculumRepository.ts";
import type { CurriculumNode } from "../../../../data/types.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { logContentMutation } from "../../services/auditLogger.ts";
import { unauthorized } from "../../utils/httpError.ts";
import {
  adminCurriculumNodeCreateSchema,
  type AdminCurriculumNodeCreateInput,
} from "../../../../shared/validation/adminCurriculumSchema.ts";
import { isSupabaseAuthError, isUniqueConstraintError } from "../../utils/supabaseErrors.ts";

const router = Router();

router.get(
  "/nodes",
  asyncHandler(async (req, res) => {
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
