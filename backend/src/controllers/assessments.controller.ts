import { Response } from "express";
import { Types } from "mongoose";

import { Assessment } from "../models/Assessment.js";
import { Plan } from "../models/Plan.js";
import { Sprint } from "../models/Sprint.js";
import { SprintDay } from "../models/SprintDay.js";
import { ensureSprintAssessment, ensureStudyMaterial, ensureStudyMaterialInBackground, sendKnowledgeResults } from "../services/studyMaterial.js";
import { claimAssessmentCompletion } from "../utils/planProgress.js";
import { AuthenticatedRequest } from "../types/authenticated-request.js";
import { badId, findOwnedSprint, findOwnedSprintDay, getUserId, handleFailure, routeParam } from "../utils/planApi.js";

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

async function claimLegacyAssessments(sprintIds: Types.ObjectId[], userId: Types.ObjectId): Promise<void> {
  // Legacy assessments have no explicit owner; a sprint has exactly one owner,
  // so bind them to that owner before exposing or mutating their attempt state.
  await Assessment.updateMany(
    { sprint_id: { $in: sprintIds }, user_id: { $exists: false } },
    { $set: { user_id: userId } },
  );
}

/**
 * Start generating material the user is about to need: the requested sprint,
 * or (no sprint named) each plan's current sprint, the first one not
 * completed. Covers plans saved without the post-save trigger (CLI runs,
 * plans from before this existed). Returns whether anything is generating.
 */
export async function startMissingMaterial(sprintIds: Types.ObjectId[], requested: boolean): Promise<boolean> {
  if (!requested) return false;
  let generating = false;
  for (const sprintId of sprintIds) {
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
    await claimLegacyAssessments(sprintIds, userId);
    const assessments = await Assessment.find({ user_id: userId, sprint_id: { $in: sprintIds } })
      .sort({ createdAt: 1 })
      .lean();
    const sprintDays = await SprintDay.find({ sprint_id: { $in: sprintIds } })
      .select("_id sprint_id day_number")
      .sort({ sprint_id: 1, day_number: 1, _id: 1 })
      .lean();
    const dayNumberById = new Map<string, number>();
    const nextDayNumberBySprint = new Map<string, number>();
    for (const day of sprintDays) {
      const sprintKey = String(day.sprint_id);
      const localDayNumber = (nextDayNumberBySprint.get(sprintKey) ?? 0) + 1;
      nextDayNumberBySprint.set(sprintKey, localDayNumber);
      dayNumberById.set(String(day._id), localDayNumber);
    }
    const sprints = await Sprint.find({ _id: { $in: sprintIds } })
      .select("_id plan_id sprint_name sprint_number")
      .lean();
    const plans = await Plan.find({ _id: { $in: sprints.map((sprint) => sprint.plan_id) } })
      .select("_id plan_name company role")
      .lean();
    const sprintById = new Map(sprints.map((sprint) => [String(sprint._id), sprint]));
    const planById = new Map(plans.map((plan) => [String(plan._id), plan]));
    const data = assessments.map((assessment) => {
      const sprint = sprintById.get(String(assessment.sprint_id));
      const plan = sprint ? planById.get(String(sprint.plan_id)) : undefined;
      const coveredDayNumbers = (assessment.covered_sprint_days ?? [])
        .map((dayId) => dayNumberById.get(String(dayId)))
        .filter((dayNumber): dayNumber is number => dayNumber !== undefined);
      const q1Days = [1, 2, 3];
      const q2Days = [4, 5, 6, 7];
      const sortedCoveredDays = [...coveredDayNumbers].sort((a, b) => a - b);
      const assessmentNumber = assessment.assessment_number === 1 || assessment.assessment_number === 2
        ? assessment.assessment_number
        : sortedCoveredDays.length === q1Days.length && sortedCoveredDays.every((day, index) => day === q1Days[index])
          ? 1
          : sortedCoveredDays.length === q2Days.length && sortedCoveredDays.every((day, index) => day === q2Days[index])
            ? 2
            : null;
      return {
        ...assessment,
        sprint_context: sprint
          ? {
              sprint_id: sprint._id,
              sprint_name: sprint.sprint_name,
              sprint_number: sprint.sprint_number,
              level: assessmentNumber === null ? null : `Q${assessmentNumber}`,
              assessment_number: assessmentNumber,
              anchor_day_number: assessmentNumber === 1 ? 3 : assessmentNumber === 2 ? 7 : null,
              plan_id: sprint.plan_id,
              plan_name: plan?.plan_name,
              company: plan?.company,
              role: plan?.role,
            }
          : null,
      };
    });
    // Dashboard polling is read-only; material is generated only by an
    // authenticated request to open a specific sprint-day assessment.
    res.json({ success: true, count: data.length, generating: false, data });
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
    let assessment = await Assessment.findOne({ _id: id, user_id: userId }).lean();
    if (!assessment) {
      const legacy = await Assessment.findOne({ _id: id, user_id: { $exists: false } }).lean();
      if (legacy && (await findOwnedSprint(legacy.sprint_id, userId))) {
        await Assessment.updateOne(
          { _id: legacy._id, user_id: { $exists: false } },
          { $set: { user_id: userId } },
        );
        assessment = await Assessment.findOne({ _id: id, user_id: userId }).lean();
      }
    }
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
      is_completed: true,
    };
    // $set, not doc.save(): older documents may not pass today's schema
    const saved = await Assessment.findOneAndUpdate(
      { _id: id, user_id: userId },
      { $set: update, $inc: { total_attempts: 1 } },
      { returnDocument: "after" },
    );
    if (!saved) return void res.status(404).json({ success: false, error: "Assessment not found." });
    sendKnowledgeResults(String(userId), questions
      .filter((q) => q.is_attempted)
      .map((q) => ({ concept: q.concept, correct: Boolean(q.is_correct) })));
    if (!assessment.is_completed) {
      const sprint = await Sprint.findById(saved.sprint_id).select("plan_id");
      if (sprint) {
        await claimAssessmentCompletion(userId, new Types.ObjectId(sprint.plan_id), new Types.ObjectId(id));
      }
    }
    res.json({ success: true, data: saved });
  } catch (error) {
    handleFailure(res, "Submit assessment attempt", error);
  }
};

/** GET /api/sprint-days/:dayId/assessment: lazily ensure then return this day's quiz. */
export const getSprintDayAssessment = async (req: AuthenticatedRequest, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const dayId = routeParam(req.params.dayId);
  if (!Types.ObjectId.isValid(dayId)) return void badId(res, "dayId");
  try {
    const owned = await findOwnedSprintDay(new Types.ObjectId(dayId), userId);
    if (!owned) return void res.status(404).json({ success: false, error: "Sprint day not found." });

    const sprintDays = await SprintDay.find({ sprint_id: owned.sprint._id })
      .select("_id day_number")
      .sort({ day_number: 1, _id: 1 })
      .lean();
    const localDayIndex = sprintDays.findIndex((day) => String(day._id) === String(owned.day._id));
    if (localDayIndex < 0) {
      return void res.status(404).json({ success: false, error: "Sprint day not found." });
    }
    const assessmentNumber = localDayIndex >= 0 && localDayIndex <= 2
      ? 1
      : localDayIndex <= 6
        ? 2
        : null;
    if (assessmentNumber === null) {
      return void res.status(404).json({ success: false, error: "No Q1/Q2 assessment is defined for this sprint day." });
    }
    await claimLegacyAssessments([owned.sprint._id as Types.ObjectId], userId);
    const assessment = await ensureSprintAssessment(owned.sprint._id, assessmentNumber);
    if (!assessment) {
      return void res.status(404).json({ success: false, error: "Assessment not available for this sprint day." });
    }
    const plan = await Plan.findById(owned.sprint.plan_id).select("plan_name company role").lean();
    res.json({
      success: true,
      data: {
        ...assessment.toObject(),
        sprint_context: {
          sprint_id: owned.sprint._id,
          sprint_name: owned.sprint.sprint_name,
          sprint_number: owned.sprint.sprint_number,
          level: `Q${assessmentNumber}`,
          assessment_number: assessmentNumber,
          anchor_day_number: assessmentNumber === 1 ? 3 : 7,
          plan_id: owned.sprint.plan_id,
          plan_name: plan?.plan_name,
          company: plan?.company,
          role: plan?.role,
        },
      },
    });
  } catch (error) {
    handleFailure(res, "Get sprint day assessment", error);
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
