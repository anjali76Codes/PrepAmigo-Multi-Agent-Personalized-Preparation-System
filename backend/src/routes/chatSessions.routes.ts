import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  listChatSessionsHandler,
  getChatSessionHandler,
  saveChatSessionHandler,
  deleteChatSessionHandler,
} from "../controllers/chatSessions.controller.js";

const router = Router();

router.get("/chat-sessions", requireAuth, listChatSessionsHandler);
router.get("/chat-sessions/:sessionId", requireAuth, getChatSessionHandler);
router.post("/chat-sessions", requireAuth, saveChatSessionHandler);
router.delete("/chat-sessions/:sessionId", requireAuth, deleteChatSessionHandler);

export default router;
