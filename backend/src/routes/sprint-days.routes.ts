import { Router } from "express";

import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  completeSprintDayHandler,
  createSprintDayHandler,
  getSprintDayHandler,
  listSprintDaysHandler,
  startSprintDayHandler,
} from "../controllers/sprintDay.controller.js";

const router = Router();

router.post("/sprints/:sprintId/days", requireAuth, createSprintDayHandler);
router.get("/sprints/:sprintId/days", requireAuth, listSprintDaysHandler);
router.post("/sprint-days", requireAuth, createSprintDayHandler);
router.get("/sprint-days/:dayId", requireAuth, getSprintDayHandler);
router.post("/sprint-days/:dayId/start", requireAuth, startSprintDayHandler);
router.post("/sprint-days/:dayId/complete", requireAuth, completeSprintDayHandler);
// PATCH too: earlier frontend builds sent PATCH, which matched no route (404,
// so day completions were never saved)
router.patch("/sprint-days/:dayId/start", requireAuth, startSprintDayHandler);
router.patch("/sprint-days/:dayId/complete", requireAuth, completeSprintDayHandler);

export default router;