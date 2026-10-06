import { Router } from "express";
import { getAssessments, submitAssessmentAttempt } from "../controllers/assessments.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getAssessments);
router.post("/:assessmentId/attempt", requireAuth, submitAssessmentAttempt);

export default router;
