import { Request, Response } from "express";
import { Flashcard } from "../models/Flashcard.js";

export const getFlashcards = async (req: Request, res: Response) => {
  try {
    const flashcards = await Flashcard.find().sort({ createdAt: 1 });
    res.json({ success: true, count: flashcards.length, data: flashcards });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching flashcards", error });
  }
};
