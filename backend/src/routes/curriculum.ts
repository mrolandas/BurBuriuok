import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.ts";
import { notFound } from "../utils/httpError.ts";
import {
  getCurriculumNodeByCode,
  listCurriculumItems,
  listCurriculumNodes,
} from "../../../data/repositories/curriculumRepository.ts";
import { listDependencies } from "../../../data/repositories/dependenciesRepository.ts";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const levelFilter = req.query.level
      ? Number.parseInt(String(req.query.level), 10)
      : undefined;

    const [nodes, items] = await Promise.all([
      listCurriculumNodes(),
      listCurriculumItems(),
    ]);

    const filteredNodes =
      Number.isInteger(levelFilter) && levelFilter !== undefined
        ? nodes.filter((node) => node.level <= (levelFilter as number))
        : nodes;

    const filteredItems =
      Number.isInteger(levelFilter) && levelFilter !== undefined
        ? items.filter((item) => {
            const parentNode = nodes.find((node) => node.code === item.nodeCode);
            return parentNode ? parentNode.level <= (levelFilter as number) : true;
          })
        : items;

    res.json({
      data: {
        nodes: filteredNodes,
        items: filteredItems,
      },
      meta: {
        fetchedAt: new Date().toISOString(),
      },
    });
  })
);

router.get(
  "/:code",
  asyncHandler(async (req, res) => {
    const { code } = req.params;
    const node = await getCurriculumNodeByCode(code);

    if (!node) {
      throw notFound(`Curriculum node '${code}' was not found.`);
    }

    const [nodes, items, dependencies] = await Promise.all([
      listCurriculumNodes(),
      listCurriculumItems(null, { nodeCode: code }),
      listDependencies(null, { sourceNodeCode: code }),
    ]);

    const childNodes = nodes.filter((entry) => entry.parentCode === code);

    res.json({
      data: {
        node,
        children: childNodes,
        items,
        dependencies,
      },
      meta: {
        fetchedAt: new Date().toISOString(),
      },
    });
  })
);

export default router;
