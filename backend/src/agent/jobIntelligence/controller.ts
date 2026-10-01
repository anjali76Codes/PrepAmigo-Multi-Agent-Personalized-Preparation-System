import { Response } from "express";
import { AuthenticatedRequest } from "../../types/authenticated-request.js";
import { getJobIntelligence } from "./service.js";
import { SerpApiError } from "./serpApiClient.js";
import { RateLimitError } from "./rateLimiter.js";
import { logger } from "../../utils/logger.js";

/**
 * Controller handler for POST /api/agents/job-intelligence
 */
export async function getJobIntelligenceHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { company, role, location, forceRefresh } = req.body || {};

    if (!role || typeof role !== "string" || !role.trim()) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: 'role' must be a non-empty string.",
      });
    }

    if (!location || typeof location !== "string" || !location.trim()) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: 'location' must be a non-empty string.",
      });
    }

    const userId = req.user?.id || req.user?.sub;

    const profile = await getJobIntelligence(
      company || "",
      role,
      location,
      {
        userId,
        forceRefresh: !!forceRefresh,
      }
    );

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err: any) {
    if (err instanceof SerpApiError) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: err.message,
      });
    }

    if (err instanceof RateLimitError) {
      return res.status(429).json({
        success: false,
        error: err.message,
      });
    }

    // Log unexpected errors internally, do not leak stack trace to client
    logger.error("Unhandled error in job intelligence controller", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred while processing job intelligence request.",
    });
  }
}
