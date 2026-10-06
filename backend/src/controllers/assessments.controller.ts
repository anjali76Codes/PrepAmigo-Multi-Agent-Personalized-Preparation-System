import { Request, Response } from "express";
import { Assessment } from "../models/Assessment.js";

export const getAssessments = async (req: Request, res: Response) => {
  try {
    const assessments = await Assessment.find().sort({ createdAt: 1 });
    res.json({ success: true, count: assessments.length, data: assessments });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching assessments", error });
  }
};
