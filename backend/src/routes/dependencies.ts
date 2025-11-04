import { Router } from "express";
import { listDependencies } from "../../../data/repositories/dependenciesRepository.ts";
import type { DependencyEntityType } from "../../../data/types.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";

function parseDependencyType(
  value: unknown
): DependencyEntityType | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (normalized === "concept" || normalized === "node") {
    return normalized;
  }
  return undefined;
}

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const {
      sourceType,
      sourceNodeCode,
      sourceConceptId,
      prerequisiteType,
      prerequisiteNodeCode,
      prerequisiteConceptId,
    } = req.query;

    const dependencies = await listDependencies(undefined, {
      sourceType: parseDependencyType(sourceType),
      sourceNodeCode: sourceNodeCode ? String(sourceNodeCode) : undefined,
      sourceConceptId: sourceConceptId ? String(sourceConceptId) : undefined,
      prerequisiteType: parseDependencyType(prerequisiteType),
      prerequisiteNodeCode: prerequisiteNodeCode
        ? String(prerequisiteNodeCode)
        : undefined,
      prerequisiteConceptId: prerequisiteConceptId
        ? String(prerequisiteConceptId)
        : undefined,
    });

    res.json({
      data: dependencies,
      meta: {
        fetchedAt: new Date().toISOString(),
        total: dependencies.length,
      },
    });
  })
);

export default router;
