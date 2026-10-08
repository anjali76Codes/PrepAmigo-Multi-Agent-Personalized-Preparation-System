import { Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";

import { config } from "../config/env.js";
import { sendDigestNow } from "../services/dailyDigest.js";

import { AuthenticatedRequest } from "../types/authenticated-request.js";
import { badId, getUserId, handleFailure, routeParam } from "../utils/planApi.js";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../services/notifications.js";

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const data = await listNotifications(userId);
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    handleFailure(res, "List notifications", error);
  }
};

export const markNotificationReadHandler = async (req: AuthenticatedRequest, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const id = routeParam(req.params.notificationId);
  if (!Types.ObjectId.isValid(id)) return void badId(res, "notificationId");
  try {
    const updated = await markNotificationRead(userId, new Types.ObjectId(id));
    if (!updated) return void res.status(404).json({ success: false, error: "Notification not found." });
    res.json({ success: true, data: updated });
  } catch (error) {
    handleFailure(res, "Mark notification read", error);
  }
};

export const markAllNotificationsReadHandler = async (req: AuthenticatedRequest, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    await markAllNotificationsRead(userId);
    res.json({ success: true });
  } catch (error) {
    handleFailure(res, "Mark all notifications read", error);
  }
};

const testDigestBody = z.object({ to: z.string().trim().email().optional() }).optional();

/**
 * POST /api/notifications/test-digest  { to?: string }
 * Sends the morning digest to the signed-in user now (a short test email if
 * nothing is scheduled today) and creates its dashboard notification.
 * `to` overrides the recipient outside production only.
 */
export const sendTestDigestHandler = async (req: AuthenticatedRequest, res: Response) => {
  const production = config.NODE_ENV === "production";
  if (!(config.ENABLE_TEST_NOTIFICATIONS ?? !production)) {
    return void res.status(404).json({ success: false, error: "Not found." });
  }
  const userId = getUserId(req, res);
  if (!userId) return;
  const body = testDigestBody.safeParse(req.body);
  if (!body.success) return void res.status(400).json({ success: false, error: "`to` must be a valid email address." });
  if (body.data?.to && production) {
    return void res.status(400).json({ success: false, error: "`to` is not allowed in production; the email goes to your account address." });
  }
  try {
    const result = await sendDigestNow(userId, body.data?.to);
    if (!result) return void res.status(404).json({ success: false, error: "User not found." });
    res.status(result.delivered ? 200 : 502).json({ success: result.delivered, data: result });
  } catch (error) {
    handleFailure(res, "Send test digest", error);
  }
};
