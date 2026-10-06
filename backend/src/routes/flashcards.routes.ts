import { Router } from "express";
import { getFlashcards } from "../controllers/flashcards.controller.js";

const router = Router();

router.get("/", getFlashcards);

export default router;
