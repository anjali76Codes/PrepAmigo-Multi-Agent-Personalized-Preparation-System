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
import { Assessment, IAssessment } from "../models/Assessment.js";
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
const assessmentInFlight = new Map<string, Promise<IAssessment | null>>();

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

/**
 * Ensure the sprint's exact Q1 (days 1–3) or Q2 (days 4–7) assessment.
 * Group identity is unique per user and sprint, and generation runs only for
 * that group's days so assessments cannot accidentally span the Q1/Q2 split.
 */
export function ensureSprintAssessment(
  sprintId: Types.ObjectId | string,
  assessmentNumber: 1 | 2,
): Promise<IAssessment | null> {
  const key = `${String(sprintId)}:${assessmentNumber}`;
  const running = assessmentInFlight.get(key);
  if (running) return running;
  const work = generateSprintAssessment(new Types.ObjectId(String(sprintId)), assessmentNumber)
    .finally(() => assessmentInFlight.delete(key));
  assessmentInFlight.set(key, work);
  return work;
}

async function generateSprintAssessment(sprintId: Types.ObjectId, assessmentNumber: 1 | 2) {
  const userId = await sprintOwner(sprintId);
  if (!userId) return null;
  const userObjectId = new Types.ObjectId(userId);
  const sprintDays = await SprintDay.find({ sprint_id: sprintId })
    .sort({ day_number: 1, _id: 1 })
    .lean();

  if (sprintDays.length === 0) return null;

  const days = assessmentNumber === 1
    ? sprintDays.slice(0, Math.min(3, sprintDays.length))
    : sprintDays.slice(3);

  const finalDays = days.length > 0 ? days : sprintDays;
  const dayIds = finalDays.map((day) => day._id as Types.ObjectId);

  let assessment = await Assessment.findOne({
    user_id: userObjectId,
    sprint_id: sprintId,
    assessment_number: assessmentNumber,
  });
  if (!assessment) {
    const legacyOrExact = await Assessment.findOne({
      user_id: userObjectId,
      sprint_id: sprintId,
      covered_sprint_days: { $all: dayIds, $size: dayIds.length },
    });
    if (legacyOrExact) {
      await Assessment.updateOne(
        { _id: legacyOrExact._id, assessment_number: { $exists: false } },
        { $set: { assessment_number: assessmentNumber } },
      );
      assessment = await Assessment.findOne({
        user_id: userObjectId,
        sprint_id: sprintId,
        assessment_number: assessmentNumber,
      });
    }
  }

  if (!assessment) {
    let questions: any[] = [];
    let cards: any[] = [];

    try {
      const response = await fetch(`${config.AGENTS_SERVICE_URL}/internal/study-material`, {
        method: "POST",
        headers: agentsAuthHeaders(userId),
        signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
        body: JSON.stringify({
          user_id: userId,
          days: finalDays.map((day, index) => ({
            day_number: day.day_number || index + 1,
            topic_title: day.topic_title,
            topic_description: day.topic_description || null,
            objectives: day.objectives || [],
            references: (day.references || []).map((ref) => ({ title: ref.title, url: ref.url })),
            concepts: day.concepts || [],
          })),
        }),
      });

      if (response.ok) {
        const body = (await response.json()) as { data?: { chunks?: Chunk[] } };
        questions = (body.data?.chunks || []).flatMap((chunk) => chunk.questions || []);
        cards = (body.data?.chunks || []).flatMap((chunk) => chunk.cards || []);
      }
    } catch (err) {
      logger.warn(`[Study material] Agent service generation warning for sprint ${sprintId} Q${assessmentNumber}: ${err}`);
    }

    if (questions.length === 0) {
      for (const d of finalDays) {
        questions.push({
          question: `Which architectural pattern or technique is most critical when implementing ${d.topic_title}?`,
          options: [
            `Apply modular encapsulation with clear boundaries and robust error handling`,
            `Directly mutate global state without synchronization mechanisms`,
            `Disable all caching layers and bypass input validation checks`,
            `Enforce strictly synchronous single-threaded blocking execution`,
          ],
          answer: "A",
          explanation: `In ${d.topic_title}, structuring components with modularity and robust error handling ensures scalability and reliability.`,
          difficulty: "medium",
          concept: d.topic_title,
        });
        if (d.objectives?.[0]) {
          questions.push({
            question: `What is the primary technical objective for: "${d.objectives[0]}"?`,
            options: [
              `Achieve high availability, optimal throughput, and strict correctness`,
              `Ignore performance bottlenecks in production deployments`,
              `Maximize database connection counts indefinitely`,
              `Store sensitive credentials in unencrypted client assets`,
            ],
            answer: "A",
            explanation: `Focusing on "${d.objectives[0]}" ensures correct system performance and system guarantees.`,
            difficulty: "medium",
            concept: d.topic_title,
          });
        }
      }
    }

    assessment = await Assessment.findOneAndUpdate(
      { user_id: userObjectId, sprint_id: sprintId, assessment_number: assessmentNumber },
      {
        $setOnInsert: {
          user_id: userObjectId,
          sprint_id: sprintId,
          assessment_number: assessmentNumber,
          covered_sprint_days: dayIds,
          questions: questions.map((question) => ({
            question: question.question,
            options: question.options,
            correct_answer: question.answer || question.correct_answer || "A",
            explanation: question.explanation || "",
            difficulty: difficulty(question.difficulty),
            type: "mcq",
            concept: question.concept || undefined,
          })),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    // Also ensure corresponding flashcard deck
    const existingDeck = await Flashcard.findOne({
      sprint_id: sprintId,
      covered_sprint_days: { $all: dayIds, $size: dayIds.length },
    });

    if (!existingDeck) {
      const finalCards = cards.length > 0
        ? cards.map((c) => ({
            front: c.front,
            back: c.back,
            difficulty: c.difficulty || "medium",
            concept: c.concept || undefined,
            tags: c.tags || [],
            is_reviewed: false,
          }))
        : finalDays.flatMap((d) => [
            {
              front: `What is the core principle behind ${d.topic_title}?`,
              back: d.objectives?.[0] || d.topic_description || `Core implementation patterns, design trade-offs, and architecture of ${d.topic_title}.`,
              difficulty: "medium",
              concept: d.topic_title,
              tags: ["core", "interview"],
              is_reviewed: false,
            },
            {
              front: `What common trade-offs should be evaluated when working with ${d.topic_title}?`,
              back: `Balancing latency vs consistency, complexity vs maintainability, and resource utilization.`,
              difficulty: "medium",
              concept: d.topic_title,
              tags: ["tradeoffs", "design"],
              is_reviewed: false,
            },
          ]);

      await Flashcard.create({
        sprint_id: sprintId,
        covered_sprint_days: dayIds,
        cards: finalCards,
        reviewed_count: 0,
        total_attempts: 0,
        is_completed: false,
      });
    }
  }

  if (!assessment) return null;
  await SprintDay.updateMany(
    { _id: { $in: dayIds }, sprint_id: sprintId },
    { $set: { assessment_id: assessment._id } },
  );
  return assessment;
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
        user_id: new Types.ObjectId(userId),
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
