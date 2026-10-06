import { Response } from "express";
import { Types } from "mongoose";

import { AuthenticatedRequest } from "../types/authenticated-request.js";
import { Plan } from "../models/Plan.js";
import { PlanProgress } from "../models/PlanProgress.js";
import { Sprint } from "../models/Sprint.js";
import { SprintDay } from "../models/SprintDay.js";
import { badId, getUserId, handleFailure, invalidBody, planBodySchema, routeParam } from "../utils/planApi.js";

export async function createPlanHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  const rawBody = req.body?.plan && typeof req.body.plan === "object" ? req.body.plan : req.body;
  const parsed = planBodySchema.safeParse(rawBody);
  if (!parsed.success) return invalidBody(res, parsed.error);

  try {
    const plan = await Plan.create({ ...parsed.data, user_id: userId, sprints: [] });
    res.status(201).json({
      success: true,
      message: "Plan created successfully.",
      id: plan._id,
      planId: plan._id,
      plan_id: plan._id,
      data: plan,
    });
  } catch (error) {
    handleFailure(res, "Create plan", error);
  }
}

export async function listPlansHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const plans = await Plan.find({ user_id: userId })
      .select("plan_name company role total_days start_date end_date completion_percent status createdAt updatedAt sprints")
      .populate({
        path: "sprints",
        options: { sort: { sprint_number: 1 } },
        populate: {
          path: "sprint_days",
          options: { sort: { day_number: 1 } },
        },
      })
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, count: plans.length, data: plans });
  } catch (error) {
    handleFailure(res, "List plans", error);
  }
}

export async function getPlanHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  const planId = routeParam(req.params.planId);
  if (!Types.ObjectId.isValid(planId)) return void badId(res, "planId");
  try {
    const plan = await Plan.findOne({ _id: planId, user_id: userId })
      .populate({
        path: "sprints",
        options: { sort: { sprint_number: 1 } },
        populate: { path: "sprint_days", options: { sort: { day_number: 1 } } },
      })
      .lean();
    if (!plan) {
      res.status(404).json({ success: false, error: "Plan not found." });
      return;
    }
    res.status(200).json({ success: true, data: plan });
  } catch (error) {
    handleFailure(res, "Get plan", error);
  }
}

export async function getPlanSummaryHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  const planId = routeParam(req.params.planId);
  if (!Types.ObjectId.isValid(planId)) return void badId(res, "planId");
  try {
    const plan = await Plan.findOne({ _id: planId, user_id: userId })
      .select("plan_name company role total_days start_date end_date completion_percent status sprints")
      .lean();
    if (!plan) {
      res.status(404).json({ success: false, error: "Plan not found." });
      return;
    }
    const sprintIds = await Sprint.find({ plan_id: plan._id }).distinct("_id");
    const [totalDays, completedDays, progress] = await Promise.all([
      SprintDay.countDocuments({ sprint_id: { $in: sprintIds } }),
      SprintDay.countDocuments({ sprint_id: { $in: sprintIds }, status: "completed" }),
      PlanProgress.findOne({ user_id: userId, plan_id: plan._id })
        .select("xp_points streak_count longest_streak weekly_bonus_count trophies")
        .lean(),
    ]);
    res.status(200).json({
      success: true,
      data: {
        plan,
        sprint_count: sprintIds.length,
        total_sprint_days: totalDays,
        completed_sprint_days: completedDays,
        progress: progress ?? { xp_points: 0, streak_count: 0, longest_streak: 0, weekly_bonus_count: 0, trophies: [] },
      },
    });
  } catch (error) {
    handleFailure(res, "Get plan summary", error);
  }
}