import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAssessmentQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  type: string;
  // the concept the question tests (feeds the user's knowledge graph)
  concept?: string;
  // User tracking fields
  is_attempted: boolean;
  user_answer?: string;
  is_correct?: boolean;
}

export interface IAssessment extends Document {
  user_id: Types.ObjectId;
  sprint_id: Types.ObjectId;
  assessment_number?: 1 | 2;
  covered_sprint_days: Types.ObjectId[];
  questions: IAssessmentQuestion[];
  // Overall tracking fields
  score: number;
  attempted_questions: number;
  correct_answers: number;
  wrong_answers: number;
  total_attempts: number;
  is_completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const assessmentQuestionSchema = new Schema<IAssessmentQuestion>(
  {
    question: { type: String, required: true, trim: true },
    options: { type: [String], required: true },
    correct_answer: { type: String, required: true, trim: true },
    explanation: { type: String, required: true, trim: true },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    type: { type: String, default: "mcq" },
    concept: { type: String, trim: true },
    is_attempted: { type: Boolean, default: false },
    user_answer: { type: String, trim: true },
    is_correct: { type: Boolean },
  },
  { _id: true },
);

const assessmentSchema = new Schema<IAssessment>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sprint_id: {
      type: Schema.Types.ObjectId,
      ref: "Sprint",
      required: true,
      index: true,
    },
    assessment_number: { type: Number, enum: [1, 2], min: 1, max: 2 },
    covered_sprint_days: [{ type: Schema.Types.ObjectId, ref: "SprintDay" }],
    questions: { type: [assessmentQuestionSchema], default: [] },
    score: { type: Number, default: 0 },
    attempted_questions: { type: Number, default: 0 },
    correct_answers: { type: Number, default: 0 },
    wrong_answers: { type: Number, default: 0 },
    total_attempts: { type: Number, default: 0 },
    is_completed: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "assessments" },
);

assessmentSchema.index(
  { user_id: 1, sprint_id: 1, assessment_number: 1 },
  { unique: true, partialFilterExpression: { assessment_number: { $exists: true } } },
);

export const Assessment =
  (mongoose.models.Assessment as mongoose.Model<IAssessment> | undefined) ??
  mongoose.model<IAssessment>("Assessment", assessmentSchema);
