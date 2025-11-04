import { Router } from "express";
import curriculumRouter from "./curriculum.ts";
import conceptsRouter from "./concepts.ts";
import dependenciesRouter from "./dependencies.ts";

const router = Router();

router.use("/curriculum", curriculumRouter);
router.use("/concepts", conceptsRouter);
router.use("/dependencies", dependenciesRouter);

export default router;
