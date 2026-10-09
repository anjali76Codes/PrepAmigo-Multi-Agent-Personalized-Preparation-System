import { Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { AuthenticatedRequest } from "../types/authenticated-request.js";
import { CustomTask } from "../models/CustomTask.js";
import { badId, getUserId, handleFailure, routeParam } from "../utils/planApi.js";

const customTaskSchema = z.object({
  planId: z.string().optional(),
  title: z.string().trim().min(1).max(250),
  description: z.string().trim().max(2000).optional().default(""),
  scheduledDate: z.string().optional(),
  estimatedMinutes: z.number().min(1).max(600).optional().default(30),
  status: z.enum(["pending", "in_progress", "completed"]).optional().default("pending"),
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(250).optional(),
  description: z.string().trim().max(2000).optional(),
  scheduledDate: z.string().optional(),
  estimatedMinutes: z.number().min(1).max(600).optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
});

export async function listCustomTasksHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;

  try {
    const tasks = await CustomTask.find({ user_id: userId }).sort({ scheduled_date: 1, createdAt: 1 }).lean();
    res.status(200).json({
      success: true,
      data: tasks.map((t) => ({
        id: String(t._id),
        _id: String(t._id),
        planId: t.plan_id ? String(t.plan_id) : undefined,
        sprint_id: t.sprint_id || "custom",
        day_number: 999,
        topic_title: t.title,
        topic_description: t.description || "",
        scheduled_date: t.scheduled_date ? t.scheduled_date.toISOString() : new Date().toISOString(),
        estimated_minutes: t.estimated_minutes || 30,
        status: t.status,
        completed_at: t.completed_at ? t.completed_at.toISOString() : null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (error) {
    handleFailure(res, "List custom tasks", error);
  }
}

export async function createCustomTaskHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;

  const parsed = customTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "Invalid task data." });
    return;
  }

  try {
    const scheduledDate = parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : new Date();
    const task = await CustomTask.create({
      user_id: userId,
      plan_id: parsed.data.planId && Types.ObjectId.isValid(parsed.data.planId) ? new Types.ObjectId(parsed.data.planId) : undefined,
      sprint_id: "custom",
      title: parsed.data.title,
      description: parsed.data.description,
      scheduled_date: isNaN(scheduledDate.getTime()) ? new Date() : scheduledDate,
      estimated_minutes: parsed.data.estimatedMinutes,
      status: parsed.data.status,
      completed_at: parsed.data.status === "completed" ? new Date() : null,
    });

    res.status(201).json({
      success: true,
      data: {
        id: String(task._id),
        _id: String(task._id),
        planId: task.plan_id ? String(task.plan_id) : undefined,
        sprint_id: "custom",
        day_number: 999,
        topic_title: task.title,
        topic_description: task.description,
        scheduled_date: task.scheduled_date.toISOString(),
        estimated_minutes: task.estimated_minutes,
        status: task.status,
        completed_at: task.completed_at ? task.completed_at.toISOString() : null,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    });
  } catch (error) {
    handleFailure(res, "Create custom task", error);
  }
}

export async function updateCustomTaskHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;

  const id = routeParam(req.params.taskId);
  if (!Types.ObjectId.isValid(id)) return void badId(res, "taskId");

  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "Invalid task data." });
    return;
  }

  try {
    const update: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) update.title = parsed.data.title;
    if (parsed.data.description !== undefined) update.description = parsed.data.description;
    if (parsed.data.estimatedMinutes !== undefined) update.estimated_minutes = parsed.data.estimatedMinutes;
    if (parsed.data.scheduledDate !== undefined) {
      const d = new Date(parsed.data.scheduledDate);
      if (!isNaN(d.getTime())) update.scheduled_date = d;
    }
    if (parsed.data.status !== undefined) {
      update.status = parsed.data.status;
      update.completed_at = parsed.data.status === "completed" ? new Date() : null;
    }

    const task = await CustomTask.findOneAndUpdate({ _id: id, user_id: userId }, { $set: update }, { returnDocument: "after" });
    if (!task) {
      res.status(404).json({ success: false, error: "Task not found." });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: String(task._id),
        _id: String(task._id),
        planId: task.plan_id ? String(task.plan_id) : undefined,
        sprint_id: "custom",
        day_number: 999,
        topic_title: task.title,
        topic_description: task.description,
        scheduled_date: task.scheduled_date.toISOString(),
        estimated_minutes: task.estimated_minutes,
        status: task.status,
        completed_at: task.completed_at ? task.completed_at.toISOString() : null,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    });
  } catch (error) {
    handleFailure(res, "Update custom task", error);
  }
}

export async function deleteCustomTaskHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;

  const id = routeParam(req.params.taskId);
  if (!Types.ObjectId.isValid(id)) return void badId(res, "taskId");

  try {
    const result = await CustomTask.deleteOne({ _id: id, user_id: userId });
    if (result.deletedCount === 0) {
      res.status(404).json({ success: false, error: "Task not found." });
      return;
    }
    res.status(200).json({ success: true, message: "Task deleted." });
  } catch (error) {
    handleFailure(res, "Delete custom task", error);
  }
}
