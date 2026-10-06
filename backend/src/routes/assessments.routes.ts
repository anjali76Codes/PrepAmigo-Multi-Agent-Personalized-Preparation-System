import { Router } from "express";
import { getAssessments } from "../controllers/assessments.controller.js";

const router = Router();

router.get("/", getAssessments);

export default router;
