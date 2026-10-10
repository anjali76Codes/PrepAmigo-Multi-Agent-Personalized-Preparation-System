import { Request, Response } from "express";
import jwt from "jsonwebtoken";
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
  if (typeof type === "string") {
    const lower = type.toLowerCase().trim();
    if (VALID_REFERENCE_TYPES.has(lower)) {
      return lower as ReferenceType;
    }
    if (lower.includes("video") || lower.includes("youtube")) return "video";
    if (lower.includes("book") || lower.includes("paper")) return "book";
    if (lower.includes("article") || lower.includes("blog") || lower.includes("post")) return "article";
    if (lower.includes("problem") || lower.includes("leetcode") || lower.includes("exercise") || lower.includes("task")) return "problem";
    if (lower.includes("course") || lower.includes("tutorial")) return "course";
  }
  return "documentation";
}

const savedRunPlanMap = new Map<string, string>(); // runId -> mongoPlanId
const savingRunPlanMap = new Map<string, Promise<string | null>>(); // runId -> in-flight save promise
const runUserMap = new Map<string, string>(); // runId -> userId

const WEBSITE_CONTEXT_LIMIT = 18000;

async function fetchProfileResumeText(userId: string): Promise<string | null> {
  if (!userId || !Types.ObjectId.isValid(userId)) return null;
  try {
    const dbUser = await User.findById(userId).select("profile.resume_text");
    if (dbUser?.profile?.resume_text) {
      logger.info(`[Agent Gateway] Using stored profile resume for user ${userId}`);
      return dbUser.profile.resume_text;
    }
  } catch (err) {
    logger.warn(`[Agent Gateway] Could not load user profile resume:`, err);
  }
  return null;
}

function scoreWebsiteDocument(document: string, queryTerms: string[]): number {
  const normalized = document.toLowerCase();
  return queryTerms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}

async function retrieveWebsiteContext(userId: string, query: string): Promise<string> {
  if (!Types.ObjectId.isValid(userId)) return "";
  const ownerId = new Types.ObjectId(userId);
  const [user, plans] = await Promise.all([
    User.findById(ownerId)
      .select("name profile.target_role profile.experience_level profile.skills profile.github_url")
      .lean(),
    Plan.find({ user_id: ownerId })
      .select("plan_name company role total_days start_date end_date sprints")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const planIds = plans.map((plan) => plan._id);
  const sprints = planIds.length
    ? await Sprint.find({ plan_id: { $in: planIds } })
        .select("plan_id sprint_number sprint_name start_date end_date")
        .sort({ sprint_number: 1 })
        .lean()
    : [];
  const sprintIds = sprints.map((sprint) => sprint._id);
  const days = sprintIds.length
    ? await SprintDay.find({ sprint_id: { $in: sprintIds } })
        .select("sprint_id day_number topic_title topic_description objectives references")
        .sort({ day_number: 1 })
        .lean()
    : [];

  const sections: string[] = [];
  if (user?.profile) {
    const skills = Array.isArray(user.profile.skills) ? user.profile.skills.join(", ") : "";
    sections.push([
      "Signed-in user's profile:",
      user.profile.target_role ? `Target role: ${user.profile.target_role}` : "",
      user.profile.experience_level ? `Experience: ${user.profile.experience_level}` : "",
      skills ? `Skills: ${skills}` : "",
      user.profile.github_url ? `GitHub: ${user.profile.github_url}` : "",
    ].filter(Boolean).join("\n"));
  }

  const queryTerms = [...new Set((query.toLowerCase().match(/[a-z0-9]{3,}/g) || []))];
  const sprintById = new Map(sprints.map((sprint) => [String(sprint._id), sprint]));
  const planById = new Map(plans.map((plan) => [String(plan._id), plan]));
  const documents = days.map((day) => {
    const sprint = sprintById.get(String(day.sprint_id));
    const plan = sprint ? planById.get(String(sprint.plan_id)) : undefined;
    const references = (day.references || [])
      .map((reference) => `${reference.title}${reference.url ? ` (${reference.url})` : ""}`)
      .join("; ");
    const content = [
      `Plan: ${plan?.plan_name || "Preparation plan"}; company: ${plan?.company || ""}; role: ${plan?.role || ""}`,
      `Sprint ${sprint?.sprint_number || ""}: ${sprint?.sprint_name || ""}`,
      `Day ${day.day_number}: ${day.topic_title}`,
      day.topic_description || "",
      ...(day.objectives || []),
      references ? `Resources: ${references}` : "",
    ].filter(Boolean).join("\n");
    return { content, score: scoreWebsiteDocument(content, queryTerms), dayNumber: day.day_number };
  });

  documents.sort((left, right) => right.score - left.score || left.dayNumber - right.dayNumber);
  if (documents.length > 0) {
    const matching = documents.filter((document) => document.score > 0);
    const selected = (matching.length > 0 ? matching : documents).slice(0, matching.length > 0 ? 10 : 5);
    sections.push(`Relevant plan, sprint, and resource content:\n${selected.map((item) => item.content).join("\n\n")}`);
  }

  return sections.join("\n\n").slice(0, WEBSITE_CONTEXT_LIMIT);
}

export async function persistGeneratedPlan(
  rawStudyPlan: any,
  runId: string,
  userId?: string | null,
): Promise<string | null> {
  if (savedRunPlanMap.has(runId)) {
    return savedRunPlanMap.get(runId)!;
  }
  if (savingRunPlanMap.has(runId)) {
    return savingRunPlanMap.get(runId)!;
  }

  const savePromise = (async () => {
    try {
      if (!rawStudyPlan || typeof rawStudyPlan !== "object") return null;

      // 1. Access the plan part of the JSON and save to Plan collection
      const planData = rawStudyPlan.plan || rawStudyPlan.nested_plan || rawStudyPlan;

      const resolvedUserId = userId || runUserMap.get(runId) || planData.user_id || rawStudyPlan.user_id;
      let targetUserId: Types.ObjectId;
      if (resolvedUserId && Types.ObjectId.isValid(resolvedUserId)) {
        targetUserId = new Types.ObjectId(resolvedUserId);
      } else {
        const defaultUser = await User.findOneAndUpdate(
          { email: "local-development-user@localhost.invalid" },
          { $setOnInsert: { name: "Local developer" } },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );
        targetUserId = defaultUser._id;
      }

      const totalDays = Number(planData.total_days) || 30;
      const startDate = new Date(planData.start_date || Date.now());
      const endDate = new Date(planData.end_date || startDate.getTime() + totalDays * 86400000);

      const plan = await Plan.create({
        user_id: targetUserId,
        plan_name: (planData.plan_name || `${planData.company || "Target"} ${planData.role || "Role"} Preparation`).trim(),
        company: (planData.company || "Target Company").trim(),
        role: (planData.role || "Target Role").trim(),
        total_days: totalDays,
        start_date: startDate,
        end_date: endDate,
        sprints: [],
        status: "in_progress",
        completion_percent: 0,
      });

      // 2. Access sprints and sprint_days parts of the JSON
      const rawSprints: any[] = Array.isArray(rawStudyPlan.sprints)
        ? rawStudyPlan.sprints
        : Array.isArray(rawStudyPlan.sprint)
        ? rawStudyPlan.sprint
        : Array.isArray(planData.sprints)
        ? planData.sprints
        : [];

      const rawDays: any[] = Array.isArray(rawStudyPlan.sprint_days)
        ? rawStudyPlan.sprint_days
        : Array.isArray(rawStudyPlan.sprintday)
        ? rawStudyPlan.sprintday
        : Array.isArray(rawStudyPlan.days)
        ? rawStudyPlan.days
        : Array.isArray(planData.sprint_days)
        ? planData.sprint_days
        : [];

      const createdSprintIds: Types.ObjectId[] = [];

      for (let idx = 0; idx < rawSprints.length; idx++) {
        const s = rawSprints[idx];
        const sprintNumber = Number(s.sprint_number) || (idx + 1);

        // Days for this sprint: nested in sprint OR matching sprint_number from sprint_days
        const sprintDaysList: any[] = Array.isArray(s.sprint_days) && s.sprint_days.length > 0
          ? s.sprint_days
          : rawDays.filter((d: any) => d && Number(d.sprint_number) === sprintNumber);

        // Place sprint object in Sprint collection
        const sprint = await Sprint.create({
          plan_id: plan._id,
          sprint_number: sprintNumber,
          sprint_name: (s.sprint_name || `Sprint ${sprintNumber}`).trim(),
          start_date: new Date(s.start_date || startDate),
          end_date: new Date(s.end_date || endDate),
          total_days: Number(s.total_days) || (sprintDaysList.length > 0 ? sprintDaysList.length : 7),
          sprint_days: [],
          status: sprintNumber === 1 ? "in_progress" : "pending",
          completion_percent: 0,
        });

        // Place sprint day objects in SprintDay collection
        const dayIds: Types.ObjectId[] = [];
        for (const d of sprintDaysList) {
          const dayNumber = Number(d.day_number) || (dayIds.length + 1);

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
            scheduled_date: new Date(d.scheduled_date || sprint.start_date),
            topic_title: String(d.topic_title || `Day ${dayNumber}`).trim().slice(0, 200),
            topic_description: d.topic_description ? String(d.topic_description).trim().slice(0, 4000) : undefined,
            objectives: Array.isArray(d.objectives)
              ? d.objectives.map((obj: any) => String(obj).trim().slice(0, 500)).filter(Boolean).slice(0, 30)
              : [],
            estimated_minutes: Number(d.estimated_minutes) > 0 ? Number(d.estimated_minutes) : 60,
            references: cleanedReferences.slice(0, 50),
            concepts: Array.isArray(d.concepts)
              ? d.concepts.map((c: any) => String(c).trim().slice(0, 120)).filter(Boolean).slice(0, 12)
              : [],
            status: dayNumber === 1 && sprintNumber === 1 ? "in_progress" : "pending",
          });

          dayIds.push(sprintDay._id);
        }

        await Sprint.updateOne({ _id: sprint._id }, { $set: { sprint_days: dayIds } });
        createdSprintIds.push(sprint._id);
      }

      await Plan.updateOne({ _id: plan._id }, { $set: { sprints: createdSprintIds } });

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
      // Study material (assessments + flashcards) is generated lazily when the user
      // reaches each assessment level, NOT eagerly at plan creation time.
      logger.info(`[Agent Gateway] Persisted study plan ${mongoPlanId} for runId ${runId} with ${createdSprintIds.length} sprints`);
      return mongoPlanId;
    } catch (err) {
      logger.error(`[Agent Gateway] Failed to persist study plan for runId ${runId}:`, err);
      return null;
    } finally {
      savingRunPlanMap.delete(runId);
    }
  })();

  savingRunPlanMap.set(runId, savePromise);
  return savePromise;
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

  // Only a safety net: the listener normally ends on the run's `completed` or
  // `failed` event. A fixed 5 minutes dropped the plan of any slower run
  // (a slow model once made a run take 6.5 minutes).
  const timer = setTimeout(cleanup, 30 * 60 * 1000);

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
  tool_call: "tool_call",
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

function pythonAuthHeaders(req: AuthenticatedRequest): Record<string, string> {
  const sessionToken = (req as any).cookies?.session;
  let bearerToken = req.headers?.authorization || (sessionToken ? `Bearer ${sessionToken}` : undefined);
  if (!bearerToken && req.user?.id) {
    try {
      const generated = jwt.sign(
        { sub: req.user.id, id: req.user.id, email: req.user.email || "user@prepamigo.local" },
        config.JWT_SECRET,
        { expiresIn: "1h" },
      );
      bearerToken = `Bearer ${generated}`;
    } catch {
      // fallback
    }
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (bearerToken) headers.Authorization = bearerToken;
  return headers;
}

function extractPlanDays(text: string | undefined): number | undefined {
  if (!text || typeof text !== "string") return undefined;
  // Match "90 days", "90-day", "90 day", etc.
  const dayMatch = text.match(/\b(\d{1,3})\s*(?:-| )?days?\b/i);
  if (dayMatch && dayMatch[1]) {
    const val = parseInt(dayMatch[1], 10);
    if (!isNaN(val) && val >= 1 && val <= 365) return val;
  }
  // Match "3 months", "2 months", "1 month"
  const monthMatch = text.match(/\b(\d{1,2})\s*(?:-| )?months?\b/i);
  if (monthMatch && monthMatch[1]) {
    const val = parseInt(monthMatch[1], 10) * 30;
    if (!isNaN(val) && val >= 1 && val <= 365) return val;
  }
  // Match "6 weeks", "4 weeks", "1 week"
  const weekMatch = text.match(/\b(\d{1,2})\s*(?:-| )?weeks?\b/i);
  if (weekMatch && weekMatch[1]) {
    const val = parseInt(weekMatch[1], 10) * 7;
    if (!isNaN(val) && val >= 1 && val <= 365) return val;
  }
  return undefined;
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
    } else if (config.ENABLE_AUTH) {
      res.status(401).json({ error: "Authentication required to run the preparation agent." });
      return;
    } else {
      try {
        const defaultUser = await User.findOne({ email: "local-development-user@localhost.invalid" });
        if (defaultUser) userId = defaultUser._id.toString();
      } catch {
        // Non-blocking in dev
      }
    }

    // Auto-ingest profile resume if not explicitly attached in chat
    const effectiveResumeText =
      resumeText || (userId ? await fetchProfileResumeText(userId) : null);
    const websiteContext = userId ? await retrieveWebsiteContext(userId, query.trim()) : "";

    // Start background listener to persist plan when completed
    if (userId) runUserMap.set(runId, userId);
    listenAndPersistPlanInBackground(runId, userId);

    const planDays = extractPlanDays(query);

    // Trigger Python LangGraph service asynchronously (non-blocking)
    const pythonEndpoint = `${config.AGENTS_SERVICE_URL}/internal/agent/execute`;
    fetch(pythonEndpoint, {
      method: "POST",
      headers: pythonAuthHeaders(authReq),
      body: JSON.stringify({
        runId,
        query: query.trim(),
        thread_id: threadId || null,
        user_id: userId,
        plan_days: planDays,
        workflow_input: {
          ...(effectiveResumeText ? { resume_text: String(effectiveResumeText).slice(0, 50000) } : {}),
          ...(websiteContext ? { website_context: websiteContext } : {}),
        },
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
    if (typeof filename !== "string" || typeof base64Data !== "string" || !filename || !base64Data) {
      res.status(400).json({ success: false, error: "Missing filename or base64Data" });
      return;
    }
    if (base64Data.length > 7_000_000) {
      res.status(413).json({ success: false, error: "Resume file must be 5MB or smaller." });
      return;
    }

    let parserResponse: Awaited<ReturnType<typeof fetch>>;
    try {
      parserResponse = await fetch(`${config.AGENTS_SERVICE_URL}/internal/agent/extract-resume`, {
        method: "POST",
        headers: pythonAuthHeaders(req as unknown as AuthenticatedRequest),
        body: JSON.stringify({ filename, base64_data: base64Data }),
      });
    } catch (error: any) {
      logger.error("[Agent Gateway] Resume parser service request failed:", error);
      res.status(502).json({ success: false, error: "Resume parsing service is unavailable. Please try again shortly." });
      return;
    }

    if (!parserResponse.headers.get("content-type")?.includes("application/json")) {
      logger.error("[Agent Gateway] Resume parser returned a non-JSON response", {
        status: parserResponse.status,
        contentType: parserResponse.headers.get("content-type"),
      });
      res.status(502).json({ success: false, error: "Resume parser returned an invalid response. Check the configured agents service URL." });
      return;
    }

    const data: unknown = await parserResponse.json().catch((error: unknown) => {
      logger.error("[Agent Gateway] Resume parser returned invalid JSON:", error);
      return null;
    });
    if (!parserResponse.ok) {
      const detail =
        data && typeof data === "object" && "detail" in data && typeof data.detail === "string"
          ? data.detail
          : data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "Resume parsing failed.";
      res.status(parserResponse.status >= 500 ? 502 : parserResponse.status).json({ success: false, error: detail });
      return;
    }
    if (!data || typeof data !== "object" || !("text" in data) || typeof data.text !== "string") {
      logger.error("[Agent Gateway] Resume parser response is missing extracted text");
      res.status(502).json({ success: false, error: "Resume parser returned an invalid response. Please try again shortly." });
      return;
    }
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
  profileResumeText?: string | null,
): void {
  const query = resume
    ? userMessage || "Continue my interview preparation request with the clarification provided."
    : userMessage ||
      `Prepare interview research for ${[
        input.company && `company ${input.company}`,
        input.role && `role ${input.role}`,
        input.location && `location ${input.location}`,
      ].filter(Boolean).join(", ") || "my next role"}.`;
  if (userId) runUserMap.set(run.runId, userId);
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
      plan_days: extractPlanDays(userMessage || query),
      workflow_mode: "interview_prep",
      workflow_input: resume
        ? {}
        : {
            ...input,
            ...(profileResumeText ? { resume_text: String(profileResumeText).slice(0, 50000) } : {}),
          },
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
    if (reservation.created) {
      const profileResumeText = await fetchProfileResumeText(userId);
      triggerInterviewPrep(req, reservation.run, userId, input, false, message, profileResumeText);
    }
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
              const streamUserId = (req as any).user?.id || (req as any).user?.sub || runUserMap.get(runId);
              const savedPlanId = await persistGeneratedPlan(studyPlan, runId, streamUserId);
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
            const streamUserId = (req as any).user?.id || (req as any).user?.sub || runUserMap.get(runId);
            const savedPlanId = await persistGeneratedPlan(studyPlan, runId, streamUserId);
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
