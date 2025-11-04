import { Router } from "express";
import { listConcepts, getConceptBySlug } from "../../../data/repositories/conceptsRepository.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";
import { notFound } from "../utils/httpError.ts";

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
