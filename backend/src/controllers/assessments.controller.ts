import { Response } from "express";
import { Types } from "mongoose";

import { Assessment } from "../models/Assessment.js";
import { Plan } from "../models/Plan.js";
import { Sprint } from "../models/Sprint.js";
import { SprintDay } from "../models/SprintDay.js";
import { ensureStudyMaterial, ensureStudyMaterialInBackground, sendKnowledgeResults } from "../services/studyMaterial.js";
import { AuthenticatedRequest } from "../types/authenticated-request.js";
import { badId, findOwnedSprint, getUserId, handleFailure, routeParam } from "../utils/planApi.js";

/** The user's sprint ids, or just `sprintId` when it is theirs (null: not theirs). */
export async function ownedSprintIds(userId: Types.ObjectId, sprintId?: string): Promise<Types.ObjectId[] | null> {
  if (sprintId) {
    if (!Types.ObjectId.isValid(sprintId)) return null;
    const sprint = await findOwnedSprint(new Types.ObjectId(sprintId), userId);
    return sprint ? [sprint._id as Types.ObjectId] : null;
  }
  const plans = await Plan.find({ user_id: userId }).select("_id").lean();
  const sprints = await Sprint.find({ plan_id: { $in: plans.map((p) => p._id) } }).select("_id").lean();
  return sprints.map((s) => s._id as Types.ObjectId);
}

/**
 * Start generating material the user is about to need: the requested sprint,
 * or (no sprint named) each plan's current sprint, the first one not
 * completed. Covers plans saved without the post-save trigger (CLI runs,
 * plans from before this existed). Returns whether anything is generating.
 */
export async function startMissingMaterial(sprintIds: Types.ObjectId[], requested: boolean): Promise<boolean> {
  let candidates = sprintIds;
  if (!requested) {
    const open = await Sprint.find({ _id: { $in: sprintIds }, status: { $ne: "completed" } })
      .sort({ sprint_number: 1 }).select("_id plan_id").lean();
    const currentByPlan = new Map<string, Types.ObjectId>();
    for (const sprint of open) {
      if (!currentByPlan.has(String(sprint.plan_id))) currentByPlan.set(String(sprint.plan_id), sprint._id as Types.ObjectId);
    }
    candidates = [...currentByPlan.values()];
  }
  let generating = false;
  for (const sprintId of candidates) {
    if (await SprintDay.exists({ sprint_id: sprintId, assessment_id: { $exists: false } })) {
      ensureStudyMaterialInBackground(sprintId);
      generating = true;
    }
  }
  return generating;
}

export const getAssessments = async (req: AuthenticatedRequest, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const sprintId = typeof req.query.sprintId === "string" ? req.query.sprintId : undefined;
    const sprintIds = await ownedSprintIds(userId, sprintId);
    if (!sprintIds) return void res.status(404).json({ success: false, error: "Sprint not found." });
    const assessments = await Assessment.find({ sprint_id: { $in: sprintIds } }).sort({ createdAt: 1 });
    const generating = await startMissingMaterial(sprintIds, Boolean(sprintId));
    res.json({ success: true, count: assessments.length, generating, data: assessments });
  } catch (error) {
    handleFailure(res, "List assessments", error);
  }
};

/**
 * POST /api/assessments/:assessmentId/attempt  { answers: ("A"|"B"|"C"|"D"|null)[] }
 * One answer per question, in order. Graded here; per-concept results go to
 * the knowledge graph.
 */
export const submitAssessmentAttempt = async (req: AuthenticatedRequest, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const id = routeParam(req.params.assessmentId);
  if (!Types.ObjectId.isValid(id)) return void badId(res, "assessmentId");
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : null;
  if (!answers) return void res.status(400).json({ success: false, error: "answers must be an array." });
  try {
    const assessment = await Assessment.findById(id).lean();
    if (!assessment || !(await findOwnedSprint(assessment.sprint_id, userId))) {
      return void res.status(404).json({ success: false, error: "Assessment not found." });
    }
    const questions = assessment.questions.map((q, i) => {
      const raw = answers[i];
      const answer = typeof raw === "string" && raw.trim() ? raw.trim().toUpperCase() : null;
      return answer === null
        ? q
        : { ...q, is_attempted: true, user_answer: answer, is_correct: answer === q.correct_answer };
    });
    const attempted = questions.filter((q) => q.is_attempted);
    const correct = attempted.filter((q) => q.is_correct).length;
    const update = {
      questions,
      attempted_questions: attempted.length,
      correct_answers: correct,
      wrong_answers: attempted.length - correct,
      score: questions.length ? Math.round((correct / questions.length) * 100) : 0,
      is_completed: questions.length > 0 && attempted.length === questions.length,
    };
    // $set, not doc.save(): older documents may not pass today's schema
    const saved = await Assessment.findByIdAndUpdate(id, { $set: update, $inc: { total_attempts: 1 } }, { returnDocument: "after" });
    sendKnowledgeResults(String(userId), questions
      .filter((q) => q.is_attempted)
      .map((q) => ({ concept: q.concept, correct: Boolean(q.is_correct) })));
    res.json({ success: true, data: saved });
  } catch (error) {
    handleFailure(res, "Submit assessment attempt", error);
  }
};

/** POST /api/sprints/:sprintId/study-material: generate what the sprint is missing, and wait for it. */
export const generateSprintMaterial = async (req: AuthenticatedRequest, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const sprintId = routeParam(req.params.sprintId);
  if (!Types.ObjectId.isValid(sprintId)) return void badId(res, "sprintId");
  try {
    if (!(await findOwnedSprint(new Types.ObjectId(sprintId), userId))) {
      return void res.status(404).json({ success: false, error: "Sprint not found." });
    }
    res.json({ success: true, data: await ensureStudyMaterial(sprintId) });
  } catch (error) {
    res.status(502).json({ success: false, error: "Study material could not be generated right now." });
  }
};
