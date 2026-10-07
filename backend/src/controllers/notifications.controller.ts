import { Response } from "express";
import { Types } from "mongoose";

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
