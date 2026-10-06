/**
 * Assessments and flashcards for a sprint, generated just in time.
 *
 * The agents service writes the material (POST /internal/study-material,
 * stateless); this backend is the only writer to MongoDB, so it sends the
 * sprint's days, validates and saves what comes back, and links each day to
 * its assessment and flashcard set.
 *
 * - Generated per sprint, when it is needed: sprint 1 right after a plan is
 *   saved, the next sprint when one is completed, or any sprint on request.
 *   Nothing is paid for sprints nobody reaches, and a later sprint can be
 *   personalised by results from earlier ones (the knowledge graph).
 * - Idempotent: only days without an assessment are sent, and one sprint is
 *   never generated twice at once (in-process lock). A chunk the model could
 *   not write is simply retried the next time the sprint is ensured.
 * - Attempt and review results go to the knowledge graph as per-concept
 *   scores (best effort: they are saved here either way).
 */
import jwt from "jsonwebtoken";
import { Types } from "mongoose";

import { config } from "../config/env.js";
import { Assessment } from "../models/Assessment.js";
import { Flashcard } from "../models/Flashcard.js";
import { Plan } from "../models/Plan.js";
import { Sprint } from "../models/Sprint.js";
import { SprintDay } from "../models/SprintDay.js";
import { logger } from "../utils/logger.js";

// generation runs one model call per 3-4 days; a sprint takes a minute at most
const GENERATION_TIMEOUT_MS = 5 * 60 * 1000;
const KNOWLEDGE_TIMEOUT_MS = 15 * 1000;
type Difficulty = "easy" | "medium" | "hard";
const DIFFICULTIES = new Set<string>(["easy", "medium", "hard"]);
const difficulty = (value: string): Difficulty => (DIFFICULTIES.has(value) ? value : "medium") as Difficulty;

type ChunkQuestion = {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: string;
  concept?: string;
};
type ChunkCard = { front: string; back: string; difficulty: string; concept?: string; tags?: string[] };
type Chunk = { day_numbers: number[]; status: "ok" | "partial" | "failed"; questions: ChunkQuestion[]; cards: ChunkCard[]; error?: string };

export type EnsureResult = { generated: number; failed: number; skipped: boolean };

const inFlight = new Map<string, Promise<EnsureResult>>();

/** Headers for a backend -> agents-service call on behalf of `userId`. */
export function agentsAuthHeaders(userId: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.JWT_SECRET) {
    const token = jwt.sign({ sub: userId, id: userId }, config.JWT_SECRET, { expiresIn: "15m" });
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function sprintOwner(sprintId: Types.ObjectId): Promise<string | null> {
  const sprint = await Sprint.findById(sprintId).select("plan_id").lean();
  if (!sprint) return null;
  const plan = await Plan.findById(sprint.plan_id).select("user_id").lean();
  return plan ? String(plan.user_id) : null;
}

/** Generate and save the material for every day of the sprint that has none yet. */
export function ensureStudyMaterial(sprintId: Types.ObjectId | string): Promise<EnsureResult> {
  const key = String(sprintId);
  const running = inFlight.get(key);
  if (running) return running;
  const work = generate(new Types.ObjectId(key)).finally(() => inFlight.delete(key));
  inFlight.set(key, work);
  return work;
}

/** ensureStudyMaterial without waiting for it; failures are logged only. */
export function ensureStudyMaterialInBackground(sprintId: Types.ObjectId | string): void {
  ensureStudyMaterial(sprintId).catch((error) => {
    logger.warn(`[Study material] Sprint ${String(sprintId)} not generated: ${error instanceof Error ? error.message : error}`);
  });
}

async function generate(sprintId: Types.ObjectId): Promise<EnsureResult> {
  const userId = await sprintOwner(sprintId);
  if (!userId) return { generated: 0, failed: 0, skipped: true };
  const days = await SprintDay.find({ sprint_id: sprintId, assessment_id: { $exists: false } })
    .sort({ day_number: 1 })
    .lean();
  if (days.length === 0) return { generated: 0, failed: 0, skipped: true };

  const response = await fetch(`${config.AGENTS_SERVICE_URL}/internal/study-material`, {
    method: "POST",
    headers: agentsAuthHeaders(userId),
    signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    body: JSON.stringify({
      user_id: userId,
      days: days.map((day) => ({
        day_number: day.day_number,
        topic_title: day.topic_title,
        topic_description: day.topic_description || null,
        objectives: day.objectives || [],
        references: (day.references || []).map((ref) => ({ title: ref.title, url: ref.url })),
        concepts: day.concepts || [],
      })),
    }),
  });
  if (!response.ok) throw new Error(`agents service answered HTTP ${response.status}`);
  const body = (await response.json()) as { data?: { chunks?: Chunk[] } };
  const chunks = body.data?.chunks || [];

  const dayIdByNumber = new Map(days.map((day) => [day.day_number, day._id]));
  let generated = 0;
  let failed = 0;
  for (const chunk of chunks) {
    const dayIds = chunk.day_numbers.map((n) => dayIdByNumber.get(n)).filter(Boolean) as Types.ObjectId[];
    if (dayIds.length === 0 || (chunk.questions.length === 0 && chunk.cards.length === 0)) {
      failed += 1;  // left without material: retried the next time the sprint is ensured
      continue;
    }
    const link: Record<string, Types.ObjectId> = {};
    if (chunk.questions.length) {
      const assessment = await Assessment.create({
        sprint_id: sprintId,
        covered_sprint_days: dayIds,
        questions: chunk.questions.map((q) => ({
          question: q.question,
          options: q.options,
          correct_answer: q.answer,
          explanation: q.explanation,
          difficulty: difficulty(q.difficulty),
          type: "mcq",
          concept: q.concept || undefined,
        })),
      });
      link.assessment_id = assessment._id as Types.ObjectId;
    }
    if (chunk.cards.length) {
      const deck = await Flashcard.create({
        sprint_id: sprintId,
        covered_sprint_days: dayIds,
        cards: chunk.cards.map((c) => ({
          front: c.front,
          back: c.back,
          difficulty: c.difficulty,
          category: "concept",
          tags: c.tags || [],
          concept: c.concept || undefined,
        })),
      });
      link.flashcard_id = deck._id as Types.ObjectId;
    }
    await SprintDay.updateMany({ _id: { $in: dayIds } }, { $set: link });
    generated += 1;
  }
  logger.info(`[Study material] Sprint ${sprintId}: ${generated} chunk(s) saved, ${failed} to retry`);
  return { generated, failed, skipped: false };
}

/** The next sprint of the same plan, when there is one. */
export async function nextSprintId(sprintId: Types.ObjectId): Promise<Types.ObjectId | null> {
  const sprint = await Sprint.findById(sprintId).select("plan_id sprint_number").lean();
  if (!sprint) return null;
  const next = await Sprint.findOne({ plan_id: sprint.plan_id, sprint_number: sprint.sprint_number + 1 })
    .select("_id")
    .lean();
  return next ? (next._id as Types.ObjectId) : null;
}

/**
 * Per-concept results to the user's knowledge graph (best effort, not
 * awaited by the request that saved them).
 */
export function sendKnowledgeResults(userId: string, results: { concept?: string; correct?: boolean; score?: number }[]): void {
  const tagged = results.filter((r) => r.concept && r.concept.trim());
  if (tagged.length === 0) return;
  fetch(`${config.AGENTS_SERVICE_URL}/internal/knowledge/attempt`, {
    method: "POST",
    headers: agentsAuthHeaders(userId),
    signal: AbortSignal.timeout(KNOWLEDGE_TIMEOUT_MS),
    body: JSON.stringify({ user_id: userId, results: tagged.slice(0, 200) }),
  }).catch((error) => {
    logger.warn(`[Knowledge graph] Results not recorded: ${error instanceof Error ? error.message : error}`);
  });
}
