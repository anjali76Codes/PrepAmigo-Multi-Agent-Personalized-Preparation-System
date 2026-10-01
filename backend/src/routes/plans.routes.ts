import { Router } from "express";

import { requireAuth } from "../middlewares/auth.middleware.js";
import { createPlanHandler, getPlanHandler, getPlanSummaryHandler, listPlansHandler } from "../controllers/plan.controller.js";

const router = Router();

router.post("/plans", requireAuth, createPlanHandler);
router.get("/plans", requireAuth, listPlansHandler);
router.get("/plans/:planId/summary", requireAuth, getPlanSummaryHandler);
router.get("/plans/:planId", requireAuth, getPlanHandler);

export default router;
