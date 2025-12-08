import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { resetContent } from "../../../../data/repositories/contentRepository.ts";

const router = Router();

router.post(
  "/reset",
  asyncHandler(async (_req, res) => {
    await resetContent();
    res.json({
      message: "Content reset successfully",
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  })
);

export default router;
