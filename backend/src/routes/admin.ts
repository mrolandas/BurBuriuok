import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.ts";

const router = Router();

router.get(
  "/status",
  asyncHandler(async (req, res) => {
    res.json({
      data: {
        ok: true,
        user: {
          id: req.authUser?.id ?? null,
          email: req.authUser?.email ?? null,
          appRole: req.authUser?.appRole ?? null,
        },
      },
      meta: {
        checkedAt: new Date().toISOString(),
      },
    });
  })
);

export default router;
