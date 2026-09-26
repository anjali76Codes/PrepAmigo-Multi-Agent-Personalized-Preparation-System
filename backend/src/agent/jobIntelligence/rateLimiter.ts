/**
 * Per-User Rate Limiter for SerpApi External Queries
 * Prevents single users from depleting SerpApi API credits while allowing unlimited cache hits.
 */

const userRequestTimestamps = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000; // 15-minute sliding window
const MAX_EXTERNAL_REQUESTS = 10; // Max 10 external calls per user per window

export class RateLimitError extends Error {
  public statusCode = 429;

  constructor(
    message = "Rate limit exceeded. You have made too many external job search requests. Please try again later."
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Checks and records an external SerpApi query attempt for a given user.
 * Must be called AFTER checking MongoDB cache so cache hits do not trigger rate limiting.
 */
export function enforceUserRateLimit(userId?: string): void {
  if (!userId) return; // Skip if no user context provided (e.g., automated test run)

  const now = Date.now();
  const timestamps = userRequestTimestamps.get(userId) || [];

  // Filter timestamps within the sliding window
  const activeTimestamps = timestamps.filter((t) => now - t < WINDOW_MS);

  if (activeTimestamps.length >= MAX_EXTERNAL_REQUESTS) {
    throw new RateLimitError(
      `Rate limit exceeded: You have reached the maximum allowed (${MAX_EXTERNAL_REQUESTS}) live job searches per 15 minutes. Cached queries remain available.`
    );
  }

  activeTimestamps.push(now);
  userRequestTimestamps.set(userId, activeTimestamps);
}
