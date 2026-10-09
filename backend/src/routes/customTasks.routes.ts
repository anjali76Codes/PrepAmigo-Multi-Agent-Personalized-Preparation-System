import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  listCustomTasksHandler,
  createCustomTaskHandler,
  updateCustomTaskHandler,
  deleteCustomTaskHandler,
} from "../controllers/customTasks.controller.js";

const router = Router();

router.get("/custom-tasks", requireAuth, listCustomTasksHandler);
router.post("/custom-tasks", requireAuth, createCustomTaskHandler);
router.patch("/custom-tasks/:taskId", requireAuth, updateCustomTaskHandler);
router.delete("/custom-tasks/:taskId", requireAuth, deleteCustomTaskHandler);

export default router;
