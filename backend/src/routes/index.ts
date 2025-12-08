import { Router } from "express";
import { requireAdminRole } from "../middleware/requireAdminRole.ts";
import authRouter from "./auth.ts";
import curriculumRouter from "./curriculum.ts";
import conceptsRouter from "./concepts.ts";
import dependenciesRouter from "./dependencies.ts";
import progressRouter from "./progress.ts";
import adminRouter from "./admin.ts";
import profileRouter from "./profile.ts";
import agentRouter from "./agent.ts";

const router = Router();

router.use("/curriculum", curriculumRouter);
router.use("/concepts", conceptsRouter);
router.use("/dependencies", dependenciesRouter);
router.use("/progress", progressRouter);
router.use("/auth", authRouter);
router.use("/profile", profileRouter);
router.use("/admin", requireAdminRole, adminRouter);
router.use("/agent", requireAdminRole, agentRouter);


export default router;
