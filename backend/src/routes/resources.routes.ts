import { Router } from "express";

import {
  createResourceHandler,
  deleteResourceHandler,
  listResourcesHandler,
  searchResourcesHandler,
  updateResourceHandler,
} from "../controllers/resources.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/resources", requireAuth, listResourcesHandler);
router.post("/resources", requireAuth, createResourceHandler);
router.patch("/resources/:resourceId", requireAuth, updateResourceHandler);
router.delete("/resources/:resourceId", requireAuth, deleteResourceHandler);
router.post("/resources/search", requireAuth, searchResourcesHandler);

export default router;
