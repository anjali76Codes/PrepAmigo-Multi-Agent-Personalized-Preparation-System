import { Router } from "express";

import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  createPlanProgressHandler,
  getPlanProgressHandler,
  getUserProgressHandler,
} from "../controllers/progress.controller.js";

const router = Router();

router.post("/plans/:planId/progress", requireAuth, createPlanProgressHandler);
router.get("/plans/:planId/progress", requireAuth, getPlanProgressHandler);
router.get("/progress", requireAuth, getUserProgressHandler);

export default router;