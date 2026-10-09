import { createHash } from "node:crypto";
import { Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";

import { config } from "../config/env.js";
import { AuthenticatedRequest } from "../types/authenticated-request.js";
import { Plan } from "../models/Plan.js";
import { RagSource } from "../models/RagSource.js";
import { Sprint } from "../models/Sprint.js";
import { UserResource } from "../models/UserResource.js";
import { User } from "../models/User.js";
import { agentsAuthHeaders } from "../services/studyMaterial.js";
import { getUserId, handleFailure, routeParam } from "../utils/planApi.js";
import { logger } from "../utils/logger.js";

const resourceUrlSchema = z.string().trim().max(2048).refine((value) => {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, "URL must use HTTP or HTTPS.");

const resourceSchema = z.object({
  parentId: z.string().trim().max(64).default("root"),
  title: z.string().trim().min(1).max(200),
  kind: z.enum(["folder", "file"]),
  content: z.string().max(100000).optional(),
  url: resourceUrlSchema.optional(),
  icon: z.string().trim().max(80).optional(),
  legacyId: z.string().trim().min(1).max(160).optional(),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(100000).optional(),
  url: resourceUrlSchema.optional(),
  icon: z.string().trim().max(80).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field is required.");

type RagDocument = {
  source_id: string;
  content_hash?: string;
  title: string;
  source_type: string;
  folder_path: string;
  content: string;
  url: string;
};

function idParam(value: string | string[] | undefined): string {
  return routeParam(value);
}

function invalid(res: Response, message: string, status = 400): void {
  res.status(status).json({ success: false, error: message });
}

async function ownedParent(userId: Types.ObjectId, parentId: string): Promise<boolean> {
  if (parentId === "root") return true;
  if (Types.ObjectId.isValid(parentId) && await UserResource.exists({ _id: parentId, user_id: userId, kind: "folder" })) {
    return true;
  }
  if (["prep-notes", "notes", "nf-f1", "nf-f2"].includes(parentId)) return true;

  const plans = await Plan.find({ user_id: userId }).select("_id").lean();
  if (!plans.length) return false;
  const sprints = await Sprint.find({ plan_id: { $in: plans.map((plan) => plan._id) } })
    .select("_id sprint_days")
    .populate({ path: "sprint_days", select: "_id day_number", options: { sort: { day_number: 1 } } })
    .lean();
  for (const sprint of sprints) {
    const sprintId = String(sprint._id);
    if (parentId === `sprint-${sprintId}`) return true;
    const days = (sprint.sprint_days as unknown as Array<{ _id: Types.ObjectId; day_number: number }>)
      .slice()
      .sort((left, right) => left.day_number - right.day_number);
    let levelNumber = 0;
    for (let offset = 0; offset < days.length; offset += 7) {
      const week = days.slice(offset, offset + 7);
      for (const [start, end] of [[0, 1], [1, 3], [3, 5], [5, 7]]) {
        if (week.slice(start, end).length > 0) {
          levelNumber += 1;
          if (parentId === `lvl-${sprintId}-level-${levelNumber}`) return true;
        }
      }
      for (const day of week) {
        if (parentId === `task-${String(day._id)}`) return true;
      }
    }
  }
  return false;
}

export async function listResourcesHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const items = await UserResource.find({ user_id: userId }).sort({ createdAt: 1 }).lean();
    res.status(200).json({ success: true, data: items.map((item) => ({
      id: String(item._id),
      parentId: item.parent_id,
      title: item.title,
      kind: item.kind,
      content: item.content,
      url: item.url,
      icon: item.icon,
      legacyId: item.legacy_id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })) });
  } catch (error) {
    handleFailure(res, "List resources", error);
  }
}

export async function createResourceHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  const parsed = resourceSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, "Resource data is invalid.");
  if (parsed.data.kind === "folder" && (parsed.data.content || parsed.data.url)) {
    return invalid(res, "Folders cannot contain note content or a URL.");
  }
  if (!await ownedParent(userId, parsed.data.parentId)) {
    return invalid(res, "The parent folder does not belong to this user.", 404);
  }
  try {
    const itemData = {
      user_id: userId,
      parent_id: parsed.data.parentId,
      title: parsed.data.title,
      kind: parsed.data.kind,
      content: parsed.data.kind === "file" ? parsed.data.content ?? "" : "",
      url: parsed.data.kind === "file" ? parsed.data.url ?? "" : "",
      icon: parsed.data.icon ?? (parsed.data.kind === "folder" ? "folder" : "journal"),
      ...(parsed.data.legacyId ? { legacy_id: parsed.data.legacyId } : {}),
    };
    const item = parsed.data.legacyId
      ? await UserResource.findOneAndUpdate(
        { user_id: userId, legacy_id: parsed.data.legacyId },
        { $setOnInsert: itemData },
        { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
      )
      : await UserResource.create(itemData);
    res.status(201).json({ success: true, data: {
      id: String(item._id),
      parentId: item.parent_id,
      title: item.title,
      kind: item.kind,
      content: item.content,
      url: item.url,
      icon: item.icon,
      legacyId: item.legacy_id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    } });
  } catch (error) {
    handleFailure(res, "Create resource", error);
  }
}

export async function updateResourceHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  const resourceId = idParam(req.params.resourceId);
  if (!Types.ObjectId.isValid(resourceId)) return invalid(res, "resourceId must be a valid MongoDB ObjectId.");
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, "Resource update is invalid.");
  try {
    const item = await UserResource.findOneAndUpdate(
      { _id: resourceId, user_id: userId },
      { $set: parsed.data },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!item) return invalid(res, "Resource not found.", 404);
    res.status(200).json({ success: true, data: {
      id: String(item._id),
      parentId: item.parent_id,
      title: item.title,
      kind: item.kind,
      content: item.content,
      url: item.url,
      icon: item.icon,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    } });
  } catch (error) {
    handleFailure(res, "Update resource", error);
  }
}

export async function deleteResourceHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  const resourceId = idParam(req.params.resourceId);
  if (!Types.ObjectId.isValid(resourceId)) return invalid(res, "resourceId must be a valid MongoDB ObjectId.");
  try {
    const items = await UserResource.find({ user_id: userId }).select("_id parent_id").lean();
    if (!items.some((item) => String(item._id) === resourceId)) return invalid(res, "Resource not found.", 404);
    const descendants = new Set([resourceId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of items) {
        if (!descendants.has(String(item._id)) && descendants.has(item.parent_id)) {
          descendants.add(String(item._id));
          changed = true;
        }
      }
    }
    await UserResource.deleteMany({ user_id: userId, _id: { $in: [...descendants] } });
    res.status(200).json({ success: true, deletedIds: [...descendants] });
  } catch (error) {
    handleFailure(res, "Delete resource", error);
  }
}

async function collectRagDocuments(userId: Types.ObjectId): Promise<RagDocument[]> {
  const resources = await UserResource.find({ user_id: userId }).lean();
  const byId = new Map(resources.map((item) => [String(item._id), item]));
  const folderPath = (item: (typeof resources)[number]): string => {
    const path = [item.title];
    const visited = new Set([String(item._id)]);
    let parentId = item.parent_id;
    while (parentId !== "root") {
      const parent = byId.get(parentId);
      if (!parent || parent.kind !== "folder" || visited.has(parentId)) break;
      visited.add(parentId);
      path.unshift(parent.title);
      parentId = parent.parent_id;
    }
    return path.join(" / ");
  };

  const documents: RagDocument[] = resources.map((item) => ({
    source_id: `resource:${String(item._id)}`,
    title: item.title,
    source_type: item.kind === "folder" ? "folder" : item.url ? "link" : "note",
    folder_path: folderPath(item),
    content: item.kind === "folder"
      ? `Folder: ${folderPath(item)}`
      : [item.content, item.url ? `URL: ${item.url}` : ""].filter(Boolean).join("\n"),
    url: item.url,
  }));

  const plans = await Plan.find({ user_id: userId })
    .select("plan_name company role sprints")
    .populate({
      path: "sprints",
      select: "sprint_number sprint_name sprint_days",
      populate: { path: "sprint_days", select: "day_number topic_title topic_description objectives concepts references" },
    })
    .lean();

  for (const plan of plans) {
    for (const sprint of (plan.sprints as unknown as Array<Record<string, unknown>>) ?? []) {
      const days = (sprint.sprint_days as Array<Record<string, unknown>>) ?? [];
      for (const day of days) {
        const dayId = String(day._id);
        const path = [plan.plan_name, String(sprint.sprint_name), `Day ${day.day_number}: ${day.topic_title}`].join(" / ");
        const objectives = Array.isArray(day.objectives) ? day.objectives.join("\n") : "";
        const concepts = Array.isArray(day.concepts) ? day.concepts.join(", ") : "";
        documents.push({
          source_id: `sprint-day:${dayId}`,
          title: `${day.topic_title}`,
          source_type: "sprint-day",
          folder_path: path,
          content: [
            `Plan: ${plan.plan_name} (${plan.role} at ${plan.company})`,
            `Sprint: ${sprint.sprint_name}`,
            `Topic: ${day.topic_title}`,
            day.topic_description,
            objectives ? `Objectives:\n${objectives}` : "",
            concepts ? `Key concepts: ${concepts}` : "",
          ].filter(Boolean).join("\n"),
          url: "",
        });
        for (const [index, reference] of ((day.references as Array<Record<string, unknown>>) ?? []).entries()) {
          documents.push({
            source_id: `sprint-reference:${dayId}:${index}`,
            title: String(reference.title || reference.url || day.topic_title),
            source_type: String(reference.type || "resource"),
            folder_path: path,
            content: [
              `Topic: ${day.topic_title}`,
              reference.description,
              reference.source ? `Publisher: ${reference.source}` : "",
              reference.url ? `URL: ${reference.url}` : "",
            ].filter(Boolean).join("\n"),
            url: String(reference.url || ""),
          });
        }
      }
    }
  }
  return documents.filter((document) => document.content.trim().length > 0);
}

export async function searchResourcesHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;
  const query = z.string().trim().min(1).max(2000).safeParse(req.body?.query);
  if (!query.success) return invalid(res, "A non-empty query of at most 2000 characters is required.");
  const history = z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(4000),
  })).max(10).safeParse(req.body?.history ?? []);
  if (!history.success) return invalid(res, "Conversation history must contain at most 10 valid messages.");

  try {
    const user = await User.findById(userId).select("ai_credits");
    const currentCredits = user?.ai_credits ?? 0;
    if (currentCredits < 2) {
      res.status(403).json({
        success: false,
        error: "You need at least 2 AI credits to use this feature. Complete levels or quizzes to earn more credits!",
        credits_needed: 2,
        current_credits: currentCredits,
      });
      return;
    }

    const documents = await collectRagDocuments(userId);
    const indexed = await RagSource.find({ user_id: userId }).lean();
    const indexedHashes = new Map(indexed.map((source) => [source.source_id, source.content_hash]));
    const liveSourceIds = new Set(documents.map((document) => document.source_id));
    const hashes = new Map<string, string>();
    const changed = documents.filter((document) => {
      const hash = createHash("sha256").update(JSON.stringify(document)).digest("hex");
      hashes.set(document.source_id, hash);
      return indexedHashes.get(document.source_id) !== hash;
    }).map((document) => ({
      ...document,
      content_hash: hashes.get(document.source_id),
    }));
    const deleted = indexed.filter((source) => !liveSourceIds.has(source.source_id)).map((source) => source.source_id);

    if (changed.length || deleted.length) {
      const syncResponse = await fetch(`${config.AGENTS_SERVICE_URL}/internal/resources/sync`, {
        method: "POST",
        headers: agentsAuthHeaders(String(userId)),
        signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({
          user_id: String(userId),
          documents: changed,
          deleted_source_ids: deleted,
        }),
      });
      if (!syncResponse.ok) {
        const detail = await syncResponse.text();
        logger.warn("Resource index sync failed", { status: syncResponse.status, detail });
        let error = "Your resources could not be indexed for search.";
        try {
          const body = JSON.parse(detail) as { detail?: unknown };
          if (syncResponse.status === 503 && typeof body.detail === "string" && body.detail.startsWith("Resource retrieval is missing configuration:")) {
            error = body.detail;
          }
        } catch {
          // Keep the user-facing error generic for non-JSON service failures.
        }
        res.status(syncResponse.status === 503 ? 503 : 502).json({ success: false, error });
        return;
      }
      const syncResult = await syncResponse.json() as { success?: boolean };
      if (!syncResult.success) {
        res.status(502).json({ success: false, error: "The resource indexing service returned an invalid response." });
        return;
      }

      const changedHashes = changed.map((document) => ({
        updateOne: {
          filter: { user_id: userId, source_id: document.source_id },
          update: { $set: {
            content_hash: document.content_hash || "",
          } },
          upsert: true,
        },
      }));
      if (changedHashes.length) await RagSource.bulkWrite(changedHashes);
      if (deleted.length) await RagSource.deleteMany({ user_id: userId, source_id: { $in: deleted } });
    }

    const response = await fetch(`${config.AGENTS_SERVICE_URL}/internal/resources/query`, {
      method: "POST",
      headers: agentsAuthHeaders(String(userId)),
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        user_id: String(userId),
        query: query.data,
        history: history.data,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      logger.warn("Resource retrieval service rejected a query", { status: response.status, detail });
      res.status(response.status === 503 ? 503 : response.status === 504 ? 504 : 502).json({
        success: false,
        error: response.status === 503
          ? "The resource search service is unavailable."
          : response.status === 504
            ? "Your resources were indexed, but answer generation timed out. Please try again."
          : "Your resources were indexed, but the assistant could not generate an answer.",
      });
      return;
    }
    const result = await response.json() as {
      success?: boolean;
      data?: { answer?: string; sources?: Array<{ source_id: string; title: string; source_type: string; folder_path: string; url: string }> };
    };
    if (!result.success || typeof result.data?.answer !== "string") {
      res.status(502).json({ success: false, error: "The resource search service returned an invalid response." });
      return;
    }

    // Deduct 2 AI Credits for the query
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { ai_credits: -2 } },
      { returnDocument: "after" }
    );

    res.status(200).json({ success: true, data: {
      answer: result.data.answer,
      sources: result.data.sources ?? [],
      ai_credits: updatedUser?.ai_credits ?? 0,
    } });
  } catch (error) {
    logger.error("Search resources failed", { error });
    res.status(502).json({ success: false, error: "The resource search service could not complete the request." });
  }
}
