import { Router } from "express";
import {
  getNotifications,
  markAllNotificationsReadHandler,
  markNotificationReadHandler,
  sendTestDigestHandler,
} from "../controllers/notifications.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getNotifications);
router.post("/test-digest", requireAuth, sendTestDigestHandler);
router.post("/read-all", requireAuth, markAllNotificationsReadHandler);
router.patch("/:notificationId/read", requireAuth, markNotificationReadHandler);

export default router;
