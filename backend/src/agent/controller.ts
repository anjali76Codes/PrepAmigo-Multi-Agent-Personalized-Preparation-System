import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { redisClient, createRedisSubscriber } from "../config/redis.js";
import { AgentStreamEvent, RunAgentRequestBody } from "./types.js";

/** Helper to format and write SSE messages compliant with standard SSE protocol */
function sendSSEMessage(res: Response, event: AgentStreamEvent): void {
  if (res.writableEnded) return;
  res.write(`id: ${event.id}\n`);
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
  if (typeof (res as any).flush === "function") {
    (res as any).flush();
  }
}

/**
 * Helper to record and publish an immediate failure event to Redis
 */
async function emitFailureToRedis(runId: string, errorMessage: string): Promise<void> {
  try {
    const historyKey = `agent:history:${runId}`;
    const channelKey = `agent:events:${runId}`;

    const failEvent: AgentStreamEvent = {
      id: `err-${Date.now()}`,
      runId,
      type: "failed",
      payload: { error: errorMessage },
      timestamp: Date.now(),
    };

    const eventJson = JSON.stringify(failEvent);
    await redisClient.rpush(historyKey, eventJson);
    await redisClient.expire(historyKey, 3600);
    await redisClient.publish(channelKey, eventJson);
  } catch (err) {
    logger.error(`[Agent Gateway] Failed to write error to Redis for runId ${runId}:`, err);
  }
}

/**
 * POST /api/agent/run
 * Generates runId, triggers Python agent service asynchronously, and returns runId immediately.
 */
export async function runAgentHandler(
  req: Request<{}, {}, RunAgentRequestBody>,
  res: Response,
): Promise<void> {
  try {
    const { query, threadId } = req.body;
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      res.status(400).json({ error: "query is required and cannot be empty" });
      return;
    }

    const runId = uuidv4();

    // Trigger Python LangGraph service asynchronously (non-blocking)
    const pythonEndpoint = `${config.AGENTS_SERVICE_URL}/internal/agent/execute`;
    fetch(pythonEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId,
        query: query.trim(),
        thread_id: threadId || null,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errBody = await response.text();
          logger.error(
            `[Agent Gateway] Python agent trigger returned status ${response.status}: ${errBody}`,
          );
          await emitFailureToRedis(
            runId,
            `Agent service returned error (${response.status}): ${errBody}`,
          );
        }
      })
      .catch(async (err) => {
        logger.error(
          `[Agent Gateway] Failed to contact Python agent service for runId ${runId}:`,
          err,
        );
        await emitFailureToRedis(
          runId,
          "Agent worker service is currently unreachable. Ensure Python service is running.",
        );
      });

    // Immediately return runId to client
    res.status(202).json({ runId });
  } catch (error: any) {
    logger.error("[Agent Gateway] Error initiating agent run:", error);
    res.status(500).json({ error: "Failed to initiate agent run" });
  }
}

/**
 * GET /api/agent/stream/:runId
 * Resilient SSE endpoint supporting history replay, multiplexed subscriptions,
 * 15s heartbeats, worker inactivity timeout, and complete resource cleanup.
 */
export async function streamAgentHandler(
  req: Request<{ runId: string }>,
  res: Response,
): Promise<void> {
  const { runId } = req.params;

  if (!runId || typeof runId !== "string" || runId.trim().length === 0) {
    res.status(400).json({ error: "Valid runId parameter is required" });
    return;
  }

  // Set SSE Headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const lastEventId =
    (req.headers["last-event-id"] as string) ||
    (req.query.lastEventId as string) ||
    null;

  const historyKey = `agent:history:${runId}`;
  const channelKey = `agent:events:${runId}`;

  let isClosed = false;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let inactivityTimer: NodeJS.Timeout | null = null;

  const MAX_INACTIVITY_MS = 35000; // If no events for 35s, assume worker crashed/dead
  const subscriber = createRedisSubscriber();

  // Resets the worker inactivity watchdog
  const resetInactivityTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
      if (isClosed || res.writableEnded) return;

      logger.warn(`[Agent Gateway] Worker timeout: No events received for 35s on runId ${runId}`);
      const timeoutEvent: AgentStreamEvent = {
        id: `err-${Date.now()}`,
        runId,
        type: "failed",
        payload: {
          error: "Agent execution timed out or Python worker process disconnected.",
        },
        timestamp: Date.now(),
      };
      sendSSEMessage(res, timeoutEvent);
      await cleanup();
    }, MAX_INACTIVITY_MS);
  };

  // Resource cleanup procedure
  const cleanup = async () => {
    if (isClosed) return;
    isClosed = true;

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
      inactivityTimer = null;
    }

    try {
      await subscriber.unsubscribe(channelKey);
      await subscriber.quit();
    } catch (err) {
      logger.debug(`[Agent Gateway] Error closing Redis subscriber for runId ${runId}:`, err);
    }

    if (!res.writableEnded) {
      res.end();
    }
  };

  // Listen for client disconnect or network abort
  req.on("close", cleanup);
  req.on("error", cleanup);
  res.on("close", cleanup);
  res.on("finish", cleanup);

  // 15-second keep-alive heartbeat
  heartbeatTimer = setInterval(() => {
    if (isClosed || res.writableEnded) return;

    const pingEvent: AgentStreamEvent = {
      id: `ping-${Date.now()}`,
      runId,
      type: "ping",
      payload: { heartbeat: true },
      timestamp: Date.now(),
    };
    sendSSEMessage(res, pingEvent);
  }, 15000);

  resetInactivityTimer();

  try {
    // 1. Replay missed historical events
    logger.info(`[Agent Gateway] Fetching replay history from Redis key: ${historyKey}`);
    const rawHistory = await redisClient.lrange(historyKey, 0, -1);
    let shouldSend = !lastEventId; // If no Last-Event-ID was passed, send full history

    let hasTerminalEvent = false;

    if (rawHistory && rawHistory.length > 0) {
      logger.info(`[Agent Gateway] Replaying ${rawHistory.length} historical event(s) for runId ${runId}`);
      for (const item of rawHistory) {
        try {
          const event: AgentStreamEvent = JSON.parse(item);

          if (shouldSend) {
            sendSSEMessage(res, event);
          } else if (event.id === lastEventId) {
            shouldSend = true;
          }

          if (event.type === "completed" || event.type === "failed") {
            hasTerminalEvent = true;
          }
        } catch (parseErr) {
          logger.warn(`[Agent Gateway] Failed to parse history event:`, parseErr);
        }
      }
    }

    // If execution is already done in history, end stream immediately without pub/sub listening
    if (hasTerminalEvent) {
      logger.info(`[Agent Gateway] Run ${runId} already finished in history. Closing SSE.`);
      await cleanup();
      return;
    }

    // 2. Subscribe to live events via Redis Pub/Sub
    logger.info(`[Agent Gateway] Subscribing to Redis channel: ${channelKey}`);
    await subscriber.subscribe(channelKey);

    subscriber.on("message", (_channel: string, message: string) => {
      if (isClosed || res.writableEnded) return;

      try {
        const event: AgentStreamEvent = JSON.parse(message);
        logger.info(`[Agent Gateway] Received live event '${event.type}' from Redis for runId ${runId}`);
        sendSSEMessage(res, event);

        // Reset inactivity watchdog when a live domain event arrives
        if (event.type !== "ping") {
          resetInactivityTimer();
        }

        // Terminal event boundary
        if (event.type === "completed" || event.type === "failed") {
          logger.info(`[Agent Gateway] Terminal event received. Cleaning up stream for runId ${runId}`);
          cleanup();
        }
      } catch (err) {
        logger.error(`[Agent Gateway] Failed to process incoming event message:`, err);
      }
    });
  } catch (error: any) {
    logger.error(`[Agent Gateway] Streaming error for runId ${runId}:`, error);

    const failEvent: AgentStreamEvent = {
      id: `err-${Date.now()}`,
      runId,
      type: "failed",
      payload: {
        error: error.message || "Internal streaming error occurred",
      },
      timestamp: Date.now(),
    };

    sendSSEMessage(res, failEvent);
    await cleanup();
  }
}
