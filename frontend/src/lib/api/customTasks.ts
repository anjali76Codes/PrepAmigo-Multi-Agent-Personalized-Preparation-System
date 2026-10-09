import { apiFetch } from "./client";

export interface CustomTaskItem {
  id: string;
  _id: string;
  planId?: string;
  sprint_id: string;
  day_number: number;
  topic_title: string;
  topic_description: string;
  scheduled_date: string;
  estimated_minutes: number;
  status: "pending" | "in_progress" | "completed";
  completed_at: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const customTasksApi = {
  list: async () => {
    return apiFetch<{ success: boolean; data: CustomTaskItem[] }>("/api/custom-tasks");
  },

  create: async (data: {
    planId?: string;
    title: string;
    description?: string;
    scheduledDate?: string;
    estimatedMinutes?: number;
    status?: "pending" | "in_progress" | "completed";
  }) => {
    return apiFetch<{ success: boolean; data: CustomTaskItem }>("/api/custom-tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: async (
    taskId: string,
    data: {
      title?: string;
      description?: string;
      scheduledDate?: string;
      estimatedMinutes?: number;
      status?: "pending" | "in_progress" | "completed";
    }
  ) => {
    return apiFetch<{ success: boolean; data: CustomTaskItem }>(`/api/custom-tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  delete: async (taskId: string) => {
    return apiFetch<{ success: boolean; message: string }>(`/api/custom-tasks/${taskId}`, {
      method: "DELETE",
    });
  },
};
