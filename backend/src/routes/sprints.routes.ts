import { Router } from "express";

import { requireAuth } from "../middlewares/auth.middleware.js";
import { createSprintHandler, getSprintHandler, listPlanSprintsHandler } from "../controllers/sprint.controller.js";
import { generateSprintMaterial } from "../controllers/assessments.controller.js";

const router = Router();

router.post("/plans/:planId/sprints", requireAuth, createSprintHandler);
router.get("/plans/:planId/sprints", requireAuth, listPlanSprintsHandler);
router.post("/sprints", requireAuth, createSprintHandler);
router.get("/sprints/:sprintId", requireAuth, getSprintHandler);
router.post("/sprints/:sprintId/study-material", requireAuth, generateSprintMaterial);

export default router;