import { Router } from "express";
import { getFlashcards, submitFlashcardReview } from "../controllers/flashcards.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getFlashcards);
router.post("/:flashcardId/review", requireAuth, submitFlashcardReview);

export default router;
