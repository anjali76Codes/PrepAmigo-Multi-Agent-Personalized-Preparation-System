import { apiFetch } from "./client";

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    source_id: string;
    title: string;
    source_type: string;
    folder_path: string;
    url: string;
  }>;
  createdAt?: string;
}

export interface ChatSessionSummary {
  id: string;
  _id: string;
  title: string;
  messageCount: number;
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSessionDetail {
  id: string;
  _id: string;
  title: string;
  messages: ChatMessageItem[];
  createdAt: string;
  updatedAt: string;
}

export const chatSessionsApi = {
  list: async () => {
    return apiFetch<{ success: boolean; data: ChatSessionSummary[] }>("/api/chat-sessions");
  },

  get: async (sessionId: string) => {
    return apiFetch<{ success: boolean; data: ChatSessionDetail }>(`/api/chat-sessions/${sessionId}`);
  },

  save: async (data: {
    sessionId?: string;
    title?: string;
    messages: ChatMessageItem[];
  }) => {
    return apiFetch<{ success: boolean; data: ChatSessionDetail }>("/api/chat-sessions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  delete: async (sessionId: string) => {
    return apiFetch<{ success: boolean; message: string }>(`/api/chat-sessions/${sessionId}`, {
      method: "DELETE",
    });
  },
};
