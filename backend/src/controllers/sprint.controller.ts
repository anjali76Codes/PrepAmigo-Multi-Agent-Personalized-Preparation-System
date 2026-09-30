import { Response } from "express";
import { Types } from "mongoose";

import { AuthenticatedRequest } from "../types/authenticated-request.js";
import { Plan } from "../models/Plan.js";
import { Sprint } from "../models/Sprint.js";
import { badId, findOwnedSprint, getUserId, handleFailure, invalidBody, routeParam, sprintBodySchema } from "../utils/planApi.js";

export async function createSprintHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  const body = { ...(req.body ?? {}), plan_id: routeParam(req.params.planId) || req.body?.plan_id };
  const parsed = sprintBodySchema.safeParse(body);
  if (!parsed.success) return invalidBody(res, parsed.error);

  try {
    const plan = await Plan.findOne({ _id: parsed.data.plan_id, user_id: userId });
    if (!plan) {
      res.status(404).json({ success: false, error: "Plan not found." });
      return;
    }
    const { plan_id: _planId, ...sprintData } = parsed.data;
    const sprint = await Sprint.create({ ...sprintData, plan_id: plan._id, sprint_days: [] });
    await Plan.updateOne({ _id: plan._id, user_id: userId }, { $addToSet: { sprints: sprint._id } });
    res.status(201).json({ success: true, message: "Sprint created successfully.", id: sprint._id, sprint_id: sprint._id, data: sprint });
  } catch (error) {
    handleFailure(res, "Create sprint", error);
  }
}

export async function listPlanSprintsHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
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
    const sprints = await Sprint.find({ plan_id: planId })
      .select("plan_id sprint_number sprint_name start_date end_date total_days completion_percent status")
      .sort({ sprint_number: 1 })
      .lean();
    res.status(200).json({ success: true, count: sprints.length, data: sprints });
  } catch (error) {
    handleFailure(res, "List plan sprints", error);
  }
}

export async function getSprintHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
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
    await sprint.populate({ path: "sprint_days", options: { sort: { day_number: 1 } } });
    res.status(200).json({ success: true, data: sprint });
  } catch (error) {
    handleFailure(res, "Get sprint", error);
  }
}