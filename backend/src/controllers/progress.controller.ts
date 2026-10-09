import { Response } from "express";
import { Types } from "mongoose";

import { AuthenticatedRequest } from "../types/authenticated-request.js";
import { Plan } from "../models/Plan.js";
import { PlanProgress } from "../models/PlanProgress.js";
import { User } from "../models/User.js";
import { calculateStreakSummary } from "../utils/planProgress.js";
import { badId, getUserId, handleFailure, routeParam } from "../utils/planApi.js";

export async function createPlanProgressHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  const planId = routeParam(req.params.planId);
  if (!Types.ObjectId.isValid(planId)) return void badId(res, "planId");
  try {
    const plan = await Plan.exists({ _id: planId, user_id: userId });
    if (!plan) {
      res.status(404).json({ success: false, error: "Plan not found." });
      return;
    }
    const progress = await PlanProgress.findOneAndUpdate(
      { user_id: userId, plan_id: new Types.ObjectId(planId) },
      { $setOnInsert: { user_id: userId, plan_id: new Types.ObjectId(planId) } },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
    res.status(201).json({ success: true, message: "Plan progress initialized.", id: progress._id, progress_id: progress._id, data: progress });
  } catch (error) {
    handleFailure(res, "Initialize plan progress", error);
  }
}

export async function getPlanProgressHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  const planId = routeParam(req.params.planId);
  if (!Types.ObjectId.isValid(planId)) return void badId(res, "planId");
  try {
    const plan = await Plan.exists({ _id: planId, user_id: userId });
    if (!plan) {
      res.status(404).json({ success: false, error: "Plan not found." });
      return;
    }
    const progress = await PlanProgress.findOne({ user_id: userId, plan_id: planId }).lean();
    if (!progress) {
      res.status(200).json({
        success: true,
        data: {
          plan_id: planId,
          xp_points: 0,
          completed_day_count: 0,
          weekly_bonus_count: 0,
          streak_count: 0,
          longest_streak: 0,
          trophies: [],
        },
      });
      return;
    }
    const streak = calculateStreakSummary(progress.completed_day_dates);
    res.status(200).json({ success: true, data: { ...progress, ...streak } });
  } catch (error) {
    handleFailure(res, "Get plan progress", error);
  }
}

export async function getUserProgressHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const [progressRecords, user] = await Promise.all([
      PlanProgress.find({ user_id: userId })
        .populate("plan_id", "plan_name company role status completion_percent")
        .lean(),
      User.findById(userId).select("ai_credits").lean(),
    ]);
    const streak = calculateStreakSummary(progressRecords.flatMap((progress) => progress.completed_day_dates));
    res.status(200).json({
      success: true,
      data: {
        xp_points: progressRecords.reduce((total, progress) => total + progress.xp_points, 0),
        ai_credits: user?.ai_credits ?? 30,
        completed_day_count: progressRecords.reduce((total, progress) => total + progress.completed_day_count, 0),
        weekly_bonus_count: progressRecords.reduce((total, progress) => total + progress.weekly_bonus_count, 0),
        ...streak,
        trophies: progressRecords.flatMap((progress) =>
          progress.trophies.map((trophy) => ({ ...trophy, plan_id: progress.plan_id })),
        ),
        plans: progressRecords,
      },
    });
  } catch (error) {
    handleFailure(res, "Get user progress", error);
  }
}