import { Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { AuthenticatedRequest } from "../types/authenticated-request.js";
import { ChatSession } from "../models/ChatSession.js";
import { badId, getUserId, handleFailure, routeParam } from "../utils/planApi.js";

const chatSourceSchema = z.object({
  source_id: z.string().optional(),
  title: z.string().optional(),
  source_type: z.string().optional(),
  folder_path: z.string().optional(),
  url: z.string().optional(),
});

const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  sources: z.array(chatSourceSchema).optional(),
  createdAt: z.string().optional(),
});

const saveSessionSchema = z.object({
  sessionId: z.string().optional(),
  title: z.string().trim().max(200).optional(),
  messages: z.array(chatMessageSchema),
});

export async function listChatSessionsHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;

  try {
    const sessions = await ChatSession.find({ user_id: userId })
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: sessions.map((s) => {
        const lastMsg = s.messages && s.messages.length > 0 ? s.messages[s.messages.length - 1] : null;
        return {
          id: String(s._id),
          _id: String(s._id),
          title: s.title || "New Chat",
          messageCount: s.messages?.length || 0,
          lastMessage: lastMsg?.content ? lastMsg.content.slice(0, 120) : "",
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      }),
    });
  } catch (error) {
    handleFailure(res, "List chat sessions", error);
  }
}

export async function getChatSessionHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;

  const sessionId = routeParam(req.params.sessionId);
  if (!Types.ObjectId.isValid(sessionId)) return void badId(res, "sessionId");

  try {
    const session = await ChatSession.findOne({ _id: sessionId, user_id: userId }).lean();
    if (!session) {
      res.status(404).json({ success: false, error: "Chat session not found." });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: String(session._id),
        _id: String(session._id),
        title: session.title,
        messages: session.messages || [],
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error) {
    handleFailure(res, "Get chat session", error);
  }
}

export async function saveChatSessionHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;

  const parsed = saveSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "Invalid chat session data." });
    return;
  }

  try {
    const { sessionId, title, messages } = parsed.data;

    let computedTitle = title;
    if (!computedTitle) {
      const firstUserMsg = messages.find((m) => m.role === "user");
      computedTitle = firstUserMsg ? firstUserMsg.content.slice(0, 60) : "New Chat";
    }

    const formattedMessages = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: m.sources,
      createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
    }));

    let session;
    if (sessionId && Types.ObjectId.isValid(sessionId)) {
      session = await ChatSession.findOneAndUpdate(
        { _id: sessionId, user_id: userId },
        {
          $set: {
            title: computedTitle,
            messages: formattedMessages,
          },
        },
        { returnDocument: "after" }
      );
    }

    if (!session) {
      session = await ChatSession.create({
        user_id: userId,
        title: computedTitle,
        messages: formattedMessages,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: String(session._id),
        _id: String(session._id),
        title: session.title,
        messages: session.messages,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error) {
    handleFailure(res, "Save chat session", error);
  }
}

export async function deleteChatSessionHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = getUserId(req, res);
  if (!userId) return;

  const sessionId = routeParam(req.params.sessionId);
  if (!Types.ObjectId.isValid(sessionId)) return void badId(res, "sessionId");

  try {
    const result = await ChatSession.deleteOne({ _id: sessionId, user_id: userId });
    if (result.deletedCount === 0) {
      res.status(404).json({ success: false, error: "Chat session not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Chat session deleted." });
  } catch (error) {
    handleFailure(res, "Delete chat session", error);
  }
}
