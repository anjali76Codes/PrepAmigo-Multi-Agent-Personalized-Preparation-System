import { Response } from "express";
import { Types } from "mongoose";

import { AuthenticatedRequest } from "../types/authenticated-request.js";
import { Plan } from "../models/Plan.js";
import { PlanProgress } from "../models/PlanProgress.js";
import { Sprint } from "../models/Sprint.js";
import { SprintDay } from "../models/SprintDay.js";
import { awardTrophy, claimDayCompletion, syncSprintAndPlan, utcDateKey } from "../utils/planProgress.js";
import { badId, findOwnedSprint, findOwnedSprintDay, getUserId, handleFailure, invalidBody, routeParam, sprintDayBodySchema } from "../utils/planApi.js";

export async function createSprintDayHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;

  const routeSprintId = routeParam(req.params.sprintId);
  const isArray = Array.isArray(req.body);
  const bodyObject = !isArray && typeof req.body === "object" && req.body !== null ? req.body : {};

  // Extract days array if provided as a list or under days / sprint_days / sprintday
  let daysList: any[] | null = null;
  if (isArray) {
    daysList = req.body;
  } else if (Array.isArray(bodyObject.days)) {
    daysList = bodyObject.days;
  } else if (Array.isArray(bodyObject.sprint_days)) {
    daysList = bodyObject.sprint_days;
  } else if (Array.isArray(bodyObject.sprintday)) {
    daysList = bodyObject.sprintday;
  }

  if (daysList !== null) {
    const defaultSprintId = routeSprintId || bodyObject.sprintId || bodyObject.sprint_id;
    if (daysList.length === 0) {
      res.status(400).json({ success: false, error: "Days array must not be empty." });
      return;
    }

    try {
      const validatedDays: Array<{ sprintId: Types.ObjectId; dayData: any }> = [];
      for (let i = 0; i < daysList.length; i++) {
        const item = daysList[i];
        const daySprintId = item?.sprintId || item?.sprint_id || defaultSprintId;
        const normalizedItem = { ...item, sprint_id: daySprintId };
        const parsed = sprintDayBodySchema.safeParse(normalizedItem);
        if (!parsed.success) {
          return invalidBody(res, parsed.error);
        }
        validatedDays.push({
          sprintId: new Types.ObjectId(parsed.data.sprint_id),
          dayData: parsed.data,
        });
      }

      // Verify sprint ownership for all unique sprint IDs
      const uniqueSprintIds = [...new Set(validatedDays.map((d) => d.sprintId.toString()))];
      for (const sId of uniqueSprintIds) {
        const sprint = await findOwnedSprint(new Types.ObjectId(sId), userId);
        if (!sprint) {
          res.status(404).json({ success: false, error: `Sprint ${sId} not found or not owned by user.` });
          return;
        }
      }

      // Create SprintDays and link to sprints
      const createdDays: any[] = [];
      const sprintToDayIdsMap = new Map<string, Types.ObjectId[]>();

      for (const { sprintId, dayData } of validatedDays) {
        const { sprint_id: _sId, ...rest } = dayData;
        const payload: Record<string, any> = { ...rest, sprint_id: sprintId };
        if (payload.topic_description === null) delete payload.topic_description;
        if (payload.estimated_minutes === null) delete payload.estimated_minutes;
        if (payload.completed_at === null) delete payload.completed_at;

        const sprintDay = await SprintDay.create(payload);
        createdDays.push(sprintDay);

        const sKey = sprintId.toString();
        if (!sprintToDayIdsMap.has(sKey)) {
          sprintToDayIdsMap.set(sKey, []);
        }
        sprintToDayIdsMap.get(sKey)!.push(sprintDay._id as Types.ObjectId);
      }

      for (const [sId, dayIds] of sprintToDayIdsMap.entries()) {
        await Sprint.updateOne({ _id: new Types.ObjectId(sId) }, { $addToSet: { sprint_days: { $each: dayIds } } });
      }

      const dayIds = createdDays.map((d) => d._id);
      res.status(201).json({
        success: true,
        message: `${createdDays.length} sprint day(s) created successfully.`,
        count: createdDays.length,
        ids: dayIds,
        dayIds: dayIds,
        sprint_day_ids: dayIds,
        data: createdDays,
      });
      return;
    } catch (error) {
      handleFailure(res, "Create sprint days in bulk", error);
      return;
    }
  }

  // Single day creation flow
  const rawDay = bodyObject.sprintday || bodyObject.day || bodyObject;
  const sprintIdVal = routeSprintId || rawDay?.sprintId || rawDay?.sprint_id || bodyObject?.sprintId || bodyObject?.sprint_id;
  const body = { ...(rawDay ?? {}), sprint_id: sprintIdVal };
  const parsed = sprintDayBodySchema.safeParse(body);
  if (!parsed.success) return invalidBody(res, parsed.error);

  try {
    const sprint = await findOwnedSprint(new Types.ObjectId(parsed.data.sprint_id), userId);
    if (!sprint) {
      res.status(404).json({ success: false, error: "Sprint not found." });
      return;
    }
    const { sprint_id: _sprintId, ...dayData } = parsed.data;
    const payload: Record<string, any> = { ...dayData, sprint_id: sprint._id };
    if (payload.topic_description === null) delete payload.topic_description;
    if (payload.estimated_minutes === null) delete payload.estimated_minutes;
    if (payload.completed_at === null) delete payload.completed_at;

    const sprintDay = await SprintDay.create(payload);
    await Sprint.updateOne({ _id: sprint._id }, { $addToSet: { sprint_days: sprintDay._id } });
    res.status(201).json({
      success: true,
      message: "Sprint day created successfully.",
      id: sprintDay._id,
      dayId: sprintDay._id,
      sprint_day_id: sprintDay._id,
      data: sprintDay,
    });
  } catch (error) {
    handleFailure(res, "Create sprint day", error);
  }
}

export async function listSprintDaysHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  const sprintId = routeParam(req.params.sprintId);
  if (!Types.ObjectId.isValid(sprintId)) return void badId(res, "sprintId");
  try {
    const sprint = await findOwnedSprint(new Types.ObjectId(sprintId), userId);
    if (!sprint) {
      res.status(404).json({ success: false, error: "Sprint not found." });
      return;
    }
    const days = await SprintDay.find({ sprint_id: sprint._id }).sort({ day_number: 1 }).lean();
    res.status(200).json({ success: true, count: days.length, data: days });
  } catch (error) {
    handleFailure(res, "List sprint days", error);
  }
}

export async function getSprintDayHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  const dayId = routeParam(req.params.dayId);
  if (!Types.ObjectId.isValid(dayId)) return void badId(res, "dayId");
  try {
    const owned = await findOwnedSprintDay(new Types.ObjectId(dayId), userId);
    if (!owned) {
      res.status(404).json({ success: false, error: "Sprint day not found." });
      return;
    }
    res.status(200).json({ success: true, data: owned.day });
  } catch (error) {
    handleFailure(res, "Get sprint day", error);
  }
}

export async function startSprintDayHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  const dayId = routeParam(req.params.dayId);
  if (!Types.ObjectId.isValid(dayId)) return void badId(res, "dayId");
  try {
    const owned = await findOwnedSprintDay(new Types.ObjectId(dayId), userId);
    if (!owned) {
      res.status(404).json({ success: false, error: "Sprint day not found." });
      return;
    }
    const { day, sprint } = owned;
    if (day.status === "completed") {
      res.status(200).json({ success: true, message: "Sprint day is already completed.", id: day._id, data: day });
      return;
    }
    day.status = "in_progress";
    await day.save();
    await Sprint.updateOne({ _id: sprint._id, status: "pending" }, { $set: { status: "in_progress" } });
    await Plan.updateOne({ _id: sprint.plan_id, status: "pending" }, { $set: { status: "in_progress" } });
    res.status(200).json({ success: true, message: "Sprint day started.", id: day._id, data: day });
  } catch (error) {
    handleFailure(res, "Start sprint day", error);
  }
}

export async function completeSprintDayHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  const dayId = routeParam(req.params.dayId);
  if (!Types.ObjectId.isValid(dayId)) return void badId(res, "dayId");
  try {
    const owned = await findOwnedSprintDay(new Types.ObjectId(dayId), userId);
    if (!owned) {
      res.status(404).json({ success: false, error: "Sprint day not found." });
      return;
    }
    const { day, sprint } = owned;
    const planId = new Types.ObjectId(sprint.plan_id);
    if (day.status !== "completed") {
      day.status = "completed";
      day.completed_at = new Date();
      await day.save();
    }

    const synchronized = await syncSprintAndPlan(new Types.ObjectId(sprint._id), planId);
    const completionDate = utcDateKey(day.completed_at ?? new Date());
    const { progress, newlyAwarded } = await claimDayCompletion(userId, planId, new Types.ObjectId(day._id), completionDate);

    if (synchronized.completedSprints >= 1) await awardTrophy(progress._id, "first_sprint");
    const halfwayThreshold = Math.ceil(synchronized.totalSprints / 2);
    if (halfwayThreshold > 0 && synchronized.completedSprints >= halfwayThreshold) {
      await awardTrophy(progress._id, "half_sprints");
    }
    if (synchronized.planPercent >= 75) await awardTrophy(progress._id, "plan_75_percent");
    if (synchronized.planStatus === "completed") await awardTrophy(progress._id, "plan_complete");

    const latestProgress = await PlanProgress.findOne({ user_id: userId, plan_id: planId });
    res.status(200).json({
      success: true,
      message: newlyAwarded ? "Sprint day completed and progress updated." : "Sprint day was already completed; progress is unchanged.",
      id: day._id,
      newly_awarded: newlyAwarded,
      data: {
        sprint_day: day,
        sprint: { id: sprint._id, status: synchronized.sprintStatus, completion_percent: synchronized.sprintPercent },
        plan: { id: planId, status: synchronized.planStatus, completion_percent: synchronized.planPercent },
        progress: latestProgress,
      },
    });
  } catch (error) {
    handleFailure(res, "Complete sprint day", error);
  }
}