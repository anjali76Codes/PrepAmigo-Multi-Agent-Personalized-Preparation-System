import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import { getJobIntelligenceHandler } from "./controller.js";

const router = Router();

// Endpoint behind existing auth middleware
router.post(
  "/api/agents/job-intelligence",
  requireAuth as any,
  getJobIntelligenceHandler as any
);

// Alias route for consistency
router.post(
  "/api/agent/job-intelligence",
  requireAuth as any,
  getJobIntelligenceHandler as any
);

export default router;
