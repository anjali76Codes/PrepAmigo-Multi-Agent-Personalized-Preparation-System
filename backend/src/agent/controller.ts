import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { AuthenticatedRequest } from "../types/authenticated-request.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { redisClient, createRedisSubscriber } from "../config/redis.js";
import { Types } from "mongoose";
import { User } from "../models/User.js";
import { Plan } from "../models/Plan.js";
import { Sprint } from "../models/Sprint.js";
import { SprintDay, ReferenceType } from "../models/SprintDay.js";
import { PlanProgress } from "../models/PlanProgress.js";
import { AgentStreamEvent, InterviewPrepField, InterviewPrepRequestBody, RunAgentRequestBody } from "./types.js";

const VALID_REFERENCE_TYPES: ReadonlySet<string> = new Set([
  "video",
  "article",
  "documentation",
  "problem",
  "course",
  "book",
]);

function normalizeReferenceType(type: unknown): ReferenceType {
  if (typeof type === "string" && VALID_REFERENCE_TYPES.has(type.toLowerCase())) {
    return type.toLowerCase() as ReferenceType;
  }
  return "documentation";
}

const savedRunPlanMap = new Map<string, string>(); // runId -> mongoPlanId

export async function persistGeneratedPlan(
  rawStudyPlan: any,
  runId: string,
  userId?: string | null,
): Promise<string | null> {
  if (savedRunPlanMap.has(runId)) {
    return savedRunPlanMap.get(runId)!;
  }

  try {
    const planObj = rawStudyPlan?.plan || rawStudyPlan;
    if (!planObj || typeof planObj !== "object") return null;

    let targetUserId: Types.ObjectId;
    if (userId && Types.ObjectId.isValid(userId)) {
      targetUserId = new Types.ObjectId(userId);
    } else {
      const defaultUser = await User.findOneAndUpdate(
        { email: "local-development-user@localhost.invalid" },
        { $setOnInsert: { name: "Local developer" } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      targetUserId = defaultUser._id;
    }

    const startDate = new Date(planObj.start_date || Date.now());
    const totalDaysNum = Number(planObj.total_days) || 30;
    const endDate = new Date(planObj.end_date || startDate.getTime() + totalDaysNum * 86400000);

    const plan = await Plan.create({
      user_id: targetUserId,
      plan_name: (planObj.plan_name || `${planObj.company || "Target"} ${planObj.role || "Role"} Preparation`).trim(),
      company: (planObj.company || "Target Company").trim(),
      role: (planObj.role || "Target Role").trim(),
      total_days: totalDaysNum,
      start_date: startDate,
      end_date: endDate,
      sprints: [],
      status: "in_progress",
      completion_percent: 0,
    });

    const sprintList = Array.isArray(planObj.sprints) ? planObj.sprints : [];
    for (const s of sprintList) {
      const sprintNumber = Number(s.sprint_number) || 1;
      const sprintStartDate = new Date(s.start_date || startDate);
      const sprintEndDate = new Date(s.end_date || endDate);
      const sprintDaysList = Array.isArray(s.sprint_days) ? s.sprint_days : [];
      const sprintTotalDays = Number(s.total_days) || (sprintDaysList.length > 0 ? sprintDaysList.length : 7);

      const sprint = await Sprint.create({
        plan_id: plan._id,
        sprint_number: sprintNumber,
        sprint_name: (s.sprint_name || `Sprint ${sprintNumber}`).trim(),
        start_date: sprintStartDate,
        end_date: sprintEndDate,
        total_days: sprintTotalDays,
        sprint_days: [],
        status: sprintNumber === 1 ? "in_progress" : "pending",
        completion_percent: 0,
      });

      const dayIds: Types.ObjectId[] = [];
      for (const d of sprintDaysList) {
        const dayNumber = Number(d.day_number) || 1;
        const dayDate = new Date(d.scheduled_date || sprintStartDate);

        const rawReferences = Array.isArray(d.references) ? d.references : [];
        const cleanedReferences = rawReferences.map((ref: any) => ({
          type: normalizeReferenceType(ref?.type),
          title: String(ref?.title || "Reference Material").trim().slice(0, 300),
          url: String(ref?.url || "https://example.com").trim().slice(0, 2048),
          source: ref?.source ? String(ref.source).trim().slice(0, 200) : undefined,
          description: ref?.description ? String(ref.description).trim().slice(0, 2000) : undefined,
          is_required: ref?.is_required !== false,
        }));

        const sprintDay = await SprintDay.create({
          sprint_id: sprint._id,
          day_number: dayNumber,
          scheduled_date: dayDate,
          topic_title: String(d.topic_title || `Day ${dayNumber}`).trim().slice(0, 200),
          topic_description: d.topic_description ? String(d.topic_description).trim().slice(0, 4000) : undefined,
          objectives: Array.isArray(d.objectives)
            ? d.objectives.map((obj: any) => String(obj).trim().slice(0, 500)).filter(Boolean).slice(0, 30)
            : [],
          estimated_minutes: Number(d.estimated_minutes) > 0 ? Number(d.estimated_minutes) : 60,
          references: cleanedReferences.slice(0, 50),
          status: dayNumber === 1 && sprintNumber === 1 ? "in_progress" : "pending",
        });

        dayIds.push(sprintDay._id);
      }

      await Sprint.updateOne({ _id: sprint._id }, { $set: { sprint_days: dayIds } });
      await Plan.updateOne({ _id: plan._id }, { $push: { sprints: sprint._id } });
    }

    await PlanProgress.findOneAndUpdate(
      { user_id: targetUserId, plan_id: plan._id },
      {
        $setOnInsert: {
          user_id: targetUserId,
          plan_id: plan._id,
          xp_points: 0,
          completed_day_count: 0,
          completed_day_dates: [],
          weekly_bonus_count: 0,
          streak_count: 0,
          longest_streak: 0,
          trophies: [],
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );

    await User.updateOne({ _id: targetUserId }, { $addToSet: { plans: plan._id } });

    const mongoPlanId = plan._id.toString();
    savedRunPlanMap.set(runId, mongoPlanId);
    logger.info(`[Agent Gateway] Persisted study plan ${mongoPlanId} for runId ${runId} with ${sprintList.length} sprints`);
    return mongoPlanId;
  } catch (err) {
    logger.error(`[Agent Gateway] Failed to persist study plan for runId ${runId}:`, err);
    return null;
  }
}

function listenAndPersistPlanInBackground(runId: string, userId?: string | null): void {
  const channelKey = `agent:events:${runId}`;
  const sub = createRedisSubscriber();
  sub.subscribe(channelKey).catch((err) => {
    logger.warn(`[Agent Gateway] Background subscriber error for runId ${runId}:`, err);
  });

  const cleanup = async () => {
    try {
      await sub.unsubscribe(channelKey);
      await sub.quit();
    } catch {}
  };

  const timer = setTimeout(cleanup, 300000); // 5-minute cleanup

  sub.on("message", async (_channel: string, msg: string) => {
    try {
      const event: AgentStreamEvent = JSON.parse(msg);
      if (event.type === "completed") {
        clearTimeout(timer);
        const studyPlan = event.payload?.result?.study_plan || event.payload?.study_plan;
        if (studyPlan) {
          await persistGeneratedPlan(studyPlan, runId, userId);
        }
        await cleanup();
      } else if (event.type === "failed") {
        clearTimeout(timer);
        await cleanup();
      }
    } catch (err) {
      logger.error(`[Agent Gateway] Background plan listener message error for runId ${runId}:`, err);
    }
  });
}

const defaultSteps: Record<AgentStreamEvent["type"], string> = {
  thinking: "thinking",
  researching: "researching",
  calling_agent: "route",
  waiting: "awaiting_input",
  processing: "processing",
  structuring: "structuring",
  completed: "final",
  failed: "failure",
  ping: "heartbeat",
};

function standardizeSsePayload(event: AgentStreamEvent): AgentStreamEvent {
  const payload = { ...event.payload };
  payload.agent = payload.agent || payload.node || "system";
  payload.step = payload.step || defaultSteps[event.type];
  if (!payload.status) payload.status = ({
    waiting: "waiting",
    completed: "completed",
    failed: "failed",
  } as Partial<Record<AgentStreamEvent["type"], string>>)[event.type] || "running";
  return { ...event, payload };
}

/** Helper to format and write SSE messages compliant with standard SSE protocol */
function sendSSEMessage(res: Response, event: AgentStreamEvent): void {
  if (res.writableEnded) return;
  event = standardizeSsePayload(event);
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
    const { query, threadId, resumeText } = req.body;
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      res.status(400).json({ error: "query is required and cannot be empty" });
      return;
    }

    const runId = uuidv4();

    let userId: string | null = null;
    const authReq = req as unknown as AuthenticatedRequest;
    if (authReq.user?.id || authReq.user?.sub) {
      userId = (authReq.user?.id || authReq.user?.sub)?.toString() || null;
    } else if (!config.ENABLE_AUTH) {
      try {
        const defaultUser = await User.findOne({ email: "local-development-user@localhost.invalid" });
        if (defaultUser) userId = defaultUser._id.toString();
      } catch {
        // Non-blocking in dev
      }
    }

    // Start background listener to persist plan when completed
    listenAndPersistPlanInBackground(runId, userId);

    // Trigger Python LangGraph service asynchronously (non-blocking)
    const pythonEndpoint = `${config.AGENTS_SERVICE_URL}/internal/agent/execute`;
    fetch(pythonEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId,
        query: query.trim(),
        thread_id: threadId || null,
        user_id: userId,
        workflow_input: resumeText ? { resume_text: String(resumeText).slice(0, 50000) } : {},
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

export async function parseResumeHandler(req: Request, res: Response): Promise<void> {
  try {
    const { filename, base64Data } = req.body;
    if (!base64Data || !filename) {
      res.status(400).json({ success: false, error: "Missing filename or base64Data" });
      return;
    }
    const response = await fetch(`${config.AGENTS_SERVICE_URL}/internal/agent/extract-resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, base64_data: base64Data }),
    });
    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ success: false, error: errText });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    logger.error("[Agent Gateway] Failed to parse resume:", error);
    res.status(500).json({ success: false, error: error?.message || "Failed to parse resume" });
  }
}

type WorkflowRun = { runId: string; threadId: string };
type WorkflowReservation = { run: WorkflowRun; created: boolean };

function optionalInput(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > 200) {
    throw new Error(`${field} must be a string of at most 200 characters.`);
  }
  return value.trim() || undefined;
}

function workflowInput(body: InterviewPrepRequestBody): Record<string, string> {
  const fields: Record<string, string> = {};
  if (body.fields !== undefined && (!body.fields || typeof body.fields !== "object" || Array.isArray(body.fields))) {
    throw new Error("fields must be an object of string values.");
  }
  for (const [key, value] of Object.entries(body.fields || {})) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)) throw new Error("Invalid workflow field name.");
    const normalized = optionalInput(value, key);
    if (normalized) fields[key] = normalized;
  }
  for (const field of ["company", "role", "location"] as const) {
    const normalized = optionalInput(body[field], field);
    if (normalized) fields[field] = normalized;
  }
  return fields;
}

function pythonAuthHeaders(req: AuthenticatedRequest): Record<string, string> {
  const sessionToken = (req as any).cookies?.session;
  const bearerToken = req.headers.authorization || (sessionToken ? `Bearer ${sessionToken}` : undefined);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (bearerToken) headers.Authorization = bearerToken;
  return headers;
}

async function reserveWorkflowRun(
  userId: string,
  idempotencyKey: string,
  threadId: string,
): Promise<WorkflowReservation> {
  const key = `agent:workflow:idempotency:${encodeURIComponent(userId)}:${encodeURIComponent(idempotencyKey)}`;
  const run = { runId: uuidv4(), threadId };
  const reserved = await redisClient.set(key, JSON.stringify(run), "EX", 86400, "NX");
  if (reserved === "OK") return { run, created: true };

  const existing = await redisClient.get(key);
  if (existing) return { run: JSON.parse(existing) as WorkflowRun, created: false };
  throw new Error("A workflow request with this idempotency key is already being registered.");
}

function triggerInterviewPrep(
  req: AuthenticatedRequest,
  run: WorkflowRun,
  userId: string,
  input: Record<string, string>,
  resume = false,
  userMessage?: string,
): void {
  const query = resume
    ? userMessage || "Continue my interview preparation request with the clarification provided."
    : userMessage ||
      `Prepare interview research for ${[
        input.company && `company ${input.company}`,
        input.role && `role ${input.role}`,
        input.location && `location ${input.location}`,
      ].filter(Boolean).join(", ") || "my next role"}.`;
  listenAndPersistPlanInBackground(run.runId, userId);
  fetch(`${config.AGENTS_SERVICE_URL}/internal/agent/execute`, {
    method: "POST",
    headers: pythonAuthHeaders(req),
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      runId: run.runId,
      query,
      thread_id: run.threadId,
      user_id: userId,
      workflow_mode: "interview_prep",
      workflow_input: resume ? {} : input,
      workflow_text_input: resume ? null : userMessage || null,
      resume_input: resume ? input : null,
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        logger.error("Python interview-prep trigger failed", { runId: run.runId, status: response.status });
        await emitFailureToRedis(run.runId, "The interview-preparation service could not start this request.");
      }
    })
    .catch(async (err) => {
      logger.error("Python interview-prep service is unreachable", { runId: run.runId, error: err?.message });
      await emitFailureToRedis(run.runId, "The interview-preparation service is currently unavailable.");
    });
}

function validateIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 128) {
    throw new Error("idempotencyKey is required and must be at most 128 characters.");
  }
  return value.trim();
}

function validateWorkflowMessage(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > 4000) {
    throw new Error("message must be a string of at most 4000 characters.");
  }
  return value.trim() || undefined;
}

export async function startInterviewPrepHandler(
  req: AuthenticatedRequest & { body: InterviewPrepRequestBody },
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }
    const input = workflowInput(req.body || {});
    const message = validateWorkflowMessage(req.body?.message);
    const idempotencyKey = validateIdempotencyKey(req.body?.idempotencyKey);
    const candidateThreadId = `interview-prep-${encodeURIComponent(userId)}-${uuidv4()}`;
    const reservation = await reserveWorkflowRun(userId, idempotencyKey, candidateThreadId);
    if (reservation.created) triggerInterviewPrep(req, reservation.run, userId, input, false, message);
    res.status(202).json({ success: true, ...reservation.run });
  } catch (error: any) {
    const status = error?.message?.includes("required")
      || error?.message?.includes("must be a string")
      || error?.message?.includes("fields must")
      || error?.message?.includes("Invalid workflow field") ? 400 : 503;
    logger.warn("Could not start interview-prep workflow", { error: error?.message });
    res.status(status).json({ success: false, error: status === 400 ? error.message : "Could not register the workflow request." });
  }
}

export async function resumeInterviewPrepHandler(
  req: AuthenticatedRequest & { body: InterviewPrepRequestBody },
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }
    const threadId = req.body?.threadId;
    const threadPrefix = `interview-prep-${encodeURIComponent(userId)}-`;
    if (typeof threadId !== "string" || !threadId.startsWith(threadPrefix) || threadId.length > 128) {
      res.status(404).json({ success: false, error: "Workflow thread was not found." });
      return;
    }
    const input = workflowInput(req.body || {});
    const answer = validateWorkflowMessage(req.body?.answer);
    if (answer) input.answer = answer;
    const message = validateWorkflowMessage(req.body?.message);
    if (message) input.answer = message;
    if (!Object.keys(input).length) {
      res.status(400).json({ success: false, error: "Provide at least one clarification field or answer." });
      return;
    }
    const idempotencyKey = validateIdempotencyKey(req.body?.idempotencyKey);
    const reservation = await reserveWorkflowRun(userId, idempotencyKey, threadId);
    if (reservation.created) triggerInterviewPrep(req, reservation.run, userId, input, true, message);
    res.status(202).json({ success: true, ...reservation.run });
  } catch (error: any) {
    const status = error?.message?.includes("required")
      || error?.message?.includes("must be a string")
      || error?.message?.includes("fields must")
      || error?.message?.includes("Invalid workflow field") ? 400 : 503;
    logger.warn("Could not resume interview-prep workflow", { error: error?.message });
    res.status(status).json({ success: false, error: status === 400 ? error.message : "Could not register the workflow resume." });
  }
}

export async function interviewPrepFieldsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const response = await fetch(`${config.AGENTS_SERVICE_URL}/api/interview-prep/fields`, {
      headers: pythonAuthHeaders(req),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Python service returned ${response.status}`);
    const payload = await response.json() as { fields?: InterviewPrepField[] };
    if (!Array.isArray(payload.fields)) throw new Error("Python service returned an invalid field schema");
    res.status(200).json({ success: true, fields: payload.fields });
  } catch (error: any) {
    logger.warn("Could not load interview-prep field schema", { error: error?.message });
    res.status(503).json({ success: false, error: "Interview-preparation fields are temporarily unavailable." });
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

  const MAX_INACTIVITY_MS = 90000; // Covers bounded parallel branches plus final evaluation.
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

          if (event.type === "completed") {
            const studyPlan = event.payload?.result?.study_plan || event.payload?.study_plan;
            if (studyPlan) {
              const savedPlanId = await persistGeneratedPlan(studyPlan, runId);
              if (savedPlanId) {
                event.payload.plan_id = savedPlanId;
                if (event.payload.result) event.payload.result.plan_id = savedPlanId;
              }
            }
          }

          if (shouldSend) {
            sendSSEMessage(res, event);
          } else if (event.id === lastEventId) {
            shouldSend = true;
          }

          if (event.type === "completed" || event.type === "failed" || event.type === "waiting") {
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

    subscriber.on("message", async (_channel: string, message: string) => {
      if (isClosed || res.writableEnded) return;

      try {
        const event: AgentStreamEvent = JSON.parse(message);
        logger.info(`[Agent Gateway] Received live event '${event.type}' from Redis for runId ${runId}`);

        if (event.type === "completed") {
          const studyPlan = event.payload?.result?.study_plan || event.payload?.study_plan;
          if (studyPlan) {
            const savedPlanId = await persistGeneratedPlan(studyPlan, runId);
            if (savedPlanId) {
              event.payload.plan_id = savedPlanId;
              if (event.payload.result) event.payload.result.plan_id = savedPlanId;
            }
          }
        }

        sendSSEMessage(res, event);

        // Reset inactivity watchdog when a live domain event arrives
        if (event.type !== "ping") {
          resetInactivityTimer();
        }

        // Terminal event boundary
        if (event.type === "completed" || event.type === "failed" || event.type === "waiting") {
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
