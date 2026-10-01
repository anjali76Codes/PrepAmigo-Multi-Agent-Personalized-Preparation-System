import mongoose, { Types } from "mongoose";
import { Response } from "express";
import { z } from "zod";

import { AuthenticatedRequest } from "../types/authenticated-request.js";
import { Plan } from "../models/Plan.js";
import { Sprint } from "../models/Sprint.js";
import { SprintDay } from "../models/SprintDay.js";
import { logger } from "./logger.js";

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ObjectId.");

export const planBodySchema = z.object({
  plan_name: z.string().trim().min(1).max(120),
  company: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  total_days: z.coerce.number().int().min(1),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
}).strict().refine((data) => data.end_date >= data.start_date, {
  message: "end_date must be on or after start_date",
  path: ["end_date"],
});

export const sprintBodySchema = z.object({
  plan_id: objectIdSchema,
  sprint_number: z.coerce.number().int().min(1),
  sprint_name: z.string().trim().min(1).max(120),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  total_days: z.coerce.number().int().min(1),
}).strict().refine((data) => data.end_date >= data.start_date, {
  message: "end_date must be on or after start_date",
  path: ["end_date"],
});

const referenceBodySchema = z.object({
  type: z.enum(["video", "article", "documentation", "problem", "course", "book"]),
  title: z.string().trim().min(1).max(300),
  url: z.string().trim().url().max(2048),
  source: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  is_required: z.boolean().default(true),
}).strict();

export const sprintDayBodySchema = z.object({
  sprint_id: objectIdSchema,
  day_number: z.coerce.number().int().min(1),
  scheduled_date: z.coerce.date(),
  topic_title: z.string().trim().min(1).max(200),
  topic_description: z.string().trim().max(4000).optional(),
  objectives: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  estimated_minutes: z.coerce.number().int().min(1).max(1440).optional(),
  references: z.array(referenceBodySchema).max(50).default([]),
}).strict();

export function getUserId(req: AuthenticatedRequest, res: Response): Types.ObjectId | null {
  const value = req.user?.id || req.user?.sub;
  if (!value || !Types.ObjectId.isValid(value)) {
    res.status(401).json({ success: false, error: "A valid authenticated user is required." });
    return null;
  }
  return new Types.ObjectId(value);
}

export function invalidBody(res: Response, error: z.ZodError): void {
  res.status(400).json({
    success: false,
    error: "Request body is invalid.",
    details: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
  });
}

export function handleFailure(res: Response, operation: string, error: unknown): void {
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    res.status(400).json({ success: false, error: "The request contains invalid model data." });
    return;
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
    res.status(409).json({ success: false, error: "A record with that plan, sprint, or day number already exists." });
    return;
  }
  logger.error(`${operation} failed`, { error });
  res.status(500).json({ success: false, error: "The request could not be completed." });
}

export function badId(res: Response, label: string): null {
  res.status(400).json({ success: false, error: `${label} must be a valid MongoDB ObjectId.` });
  return null;
}

export function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export async function findOwnedSprint(sprintId: Types.ObjectId, userId: Types.ObjectId) {
  const sprint = await Sprint.findById(sprintId);
  if (!sprint) return null;
  const ownsPlan = await Plan.exists({ _id: sprint.plan_id, user_id: userId });
  return ownsPlan ? sprint : null;
}

export async function findOwnedSprintDay(dayId: Types.ObjectId, userId: Types.ObjectId) {
  const day = await SprintDay.findById(dayId);
  if (!day) return null;
  const sprint = await findOwnedSprint(day.sprint_id, userId);
  return sprint ? { day, sprint } : null;
}
