import mongoose, { Document, Schema, Types } from "mongoose";

export interface IFlashcardItem {
  front: string;
  back: string;
  difficulty?: string;
  category?: string;
  tags: string[];
  concept?: string;
  // User tracking fields
  is_reviewed: boolean;
  confidence_level?: "easy" | "medium" | "hard" | "again";
  last_reviewed_at?: Date;
}

export interface IFlashcard extends Document {
  sprint_id: Types.ObjectId;
  covered_sprint_days: Types.ObjectId[];
  cards: IFlashcardItem[];
  // Overall tracking fields
  reviewed_count: number;
  total_attempts: number;
  is_completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const flashcardItemSchema = new Schema<IFlashcardItem>(
  {
    front: { type: String, required: true, trim: true },
    back: { type: String, required: true, trim: true },
    difficulty: { type: String, trim: true },
    category: { type: String, trim: true },
    tags: { type: [String], default: [] },
    concept: { type: String, trim: true },
    is_reviewed: { type: Boolean, default: false },
    confidence_level: { type: String, enum: ["easy", "medium", "hard", "again"] },
    last_reviewed_at: { type: Date },
  },
  { _id: true },
);

const flashcardSchema = new Schema<IFlashcard>(
  {
    sprint_id: {
      type: Schema.Types.ObjectId,
      ref: "Sprint",
      required: true,
      index: true,
    },
    covered_sprint_days: [{ type: Schema.Types.ObjectId, ref: "SprintDay" }],
    cards: { type: [flashcardItemSchema], default: [] },
    reviewed_count: { type: Number, default: 0 },
    total_attempts: { type: Number, default: 0 },
    is_completed: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "flashcards" },
);

export const Flashcard =
  (mongoose.models.Flashcard as mongoose.Model<IFlashcard> | undefined) ??
  mongoose.model<IFlashcard>("Flashcard", flashcardSchema);
