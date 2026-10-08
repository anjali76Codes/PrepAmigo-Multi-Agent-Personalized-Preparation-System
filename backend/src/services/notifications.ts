import { Types } from "mongoose";
import { Notification, NotificationType } from "../models/Notification.js";

export async function createNotification(
  userId: Types.ObjectId | string,
  type: NotificationType,
  title: string,
  message: string,
  reason?: string,
) {
  return Notification.create({ user_id: userId, type, title, message, reason });
}

export async function listNotifications(userId: Types.ObjectId, limit = 50) {
  return Notification.find({ user_id: userId }).sort({ createdAt: -1 }).limit(limit).lean();
}

export async function markNotificationRead(userId: Types.ObjectId, id: Types.ObjectId) {
  return Notification.findOneAndUpdate(
    { _id: id, user_id: userId },
    { $set: { read: true } },
    { returnDocument: "after" },
  );
}

export async function markAllNotificationsRead(userId: Types.ObjectId) {
  await Notification.updateMany({ user_id: userId, read: false }, { $set: { read: true } });
}

/** Has a daily-digest notification been recorded for this user since `since`? */
export async function hasDigestSince(userId: Types.ObjectId, since: Date): Promise<boolean> {
  return Boolean(
    await Notification.exists({ user_id: userId, type: "daily-digest", createdAt: { $gte: since } }),
  );
}
