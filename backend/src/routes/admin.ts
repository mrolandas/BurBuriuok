import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.ts";
import conceptsRouter from "./admin/concepts.ts";
import curriculumRouter from "./admin/curriculum.ts";
import mediaRouter from "./admin/media.ts";
import usersRouter from "./admin/users.ts";
import settingsRouter from "./admin/settings.ts";

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

router.use("/concepts", conceptsRouter);
router.use("/curriculum", curriculumRouter);
router.use("/media", mediaRouter);
router.use("/users", usersRouter);
router.use("/settings", settingsRouter);

export default router;
