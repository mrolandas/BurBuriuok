import { Router } from "express";
import curriculumRouter from "./curriculum.ts";
import conceptsRouter from "./concepts.ts";
import dependenciesRouter from "./dependencies.ts";
import progressRouter from "./progress.ts";

const router = Router();

router.use("/curriculum", curriculumRouter);
router.use("/concepts", conceptsRouter);
router.use("/dependencies", dependenciesRouter);
router.use("/progress", progressRouter);

export default router;
