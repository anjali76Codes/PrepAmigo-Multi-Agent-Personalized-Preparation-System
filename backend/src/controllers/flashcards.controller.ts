import { Response } from "express";
import { Types } from "mongoose";

import { Flashcard } from "../models/Flashcard.js";
import { sendKnowledgeResults } from "../services/studyMaterial.js";
import { AuthenticatedRequest } from "../types/authenticated-request.js";
import { badId, findOwnedSprint, getUserId, handleFailure, routeParam } from "../utils/planApi.js";
import { ownedSprintIds } from "./assessments.controller.js";


// the deck's rating buttons (Hard 1, Okay 3, Easy 5) -> stored confidence, and
// what each says about the concept for the knowledge graph
const CONFIDENCE: Record<number, "hard" | "medium" | "easy"> = { 1: "hard", 3: "medium", 5: "easy" };
const CONFIDENCE_SCORE = { hard: 0.2, medium: 0.6, easy: 1.0 } as const;

export const getFlashcards = async (req: AuthenticatedRequest, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const sprintId = typeof req.query.sprintId === "string" ? req.query.sprintId : undefined;
    const sprintIds = await ownedSprintIds(userId, sprintId);
    if (!sprintIds) return void res.status(404).json({ success: false, error: "Sprint not found." });
    const flashcards = await Flashcard.find({ sprint_id: { $in: sprintIds } }).sort({ createdAt: 1 });
    // Do NOT generate study material here: flashcards are created lazily when the
    // user reaches an assessment level (GET /api/sprint-days/:dayId/assessment).
    res.json({ success: true, count: flashcards.length, generating: false, data: flashcards });
  } catch (error) {
    handleFailure(res, "List flashcards", error);
  }
};


/**
 * POST /api/flashcards/:flashcardId/review  { ratings: (1|3|5|null)[] }
 * One rating per card, in order (Hard / Okay / Easy).
 */
export const submitFlashcardReview = async (req: AuthenticatedRequest, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const id = routeParam(req.params.flashcardId);
  if (!Types.ObjectId.isValid(id)) return void badId(res, "flashcardId");
  const ratings = Array.isArray(req.body?.ratings) ? req.body.ratings : null;
  if (!ratings) return void res.status(400).json({ success: false, error: "ratings must be an array." });
  try {
    const deck = await Flashcard.findById(id).lean();
    if (!deck || !(await findOwnedSprint(deck.sprint_id, userId))) {
      return void res.status(404).json({ success: false, error: "Flashcard set not found." });
    }
    const now = new Date();
    const cards = deck.cards.map((card, i) => {
      const confidence = CONFIDENCE[Number(ratings[i])];
      return confidence ? { ...card, is_reviewed: true, confidence_level: confidence, last_reviewed_at: now } : card;
    });
    const reviewed = cards.filter((c) => c.is_reviewed).length;
    const saved = await Flashcard.findByIdAndUpdate(
      id,
      { $set: { cards, reviewed_count: reviewed, is_completed: cards.length > 0 && reviewed === cards.length },
        $inc: { total_attempts: 1 } },
      { returnDocument: "after" },
    );
    sendKnowledgeResults(String(userId), cards
      .filter((c, i) => CONFIDENCE[Number(ratings[i])])
      .map((c) => ({ concept: c.concept, score: CONFIDENCE_SCORE[c.confidence_level as keyof typeof CONFIDENCE_SCORE] })));
    res.json({ success: true, data: saved });
  } catch (error) {
    handleFailure(res, "Submit flashcard review", error);
  }
};
