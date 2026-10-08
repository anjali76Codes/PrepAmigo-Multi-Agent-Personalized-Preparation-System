import { apiFetch } from "./client";
import type { Notification } from "../../data/mockData";

export interface ApiNotification {
  _id: string;
  type: Notification["type"];
  title: string;
  message: string;
  reason?: string;
  read: boolean;
  createdAt: string;
}

export function apiNotificationToNotification(n: ApiNotification): Notification {
  return {
    id: n._id,
    type: n.type,
    title: n.title,
    message: n.message,
    reason: n.reason,
    timestamp: n.createdAt,
    read: n.read,
  };
}

export const notificationsApi = {
  list: () => apiFetch<{ success: boolean; count: number; data: ApiNotification[] }>("/api/notifications"),
  markRead: (id: string) =>
    apiFetch<{ success: boolean; data: ApiNotification }>(`/api/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => apiFetch<{ success: boolean }>("/api/notifications/read-all", { method: "POST" }),
};
