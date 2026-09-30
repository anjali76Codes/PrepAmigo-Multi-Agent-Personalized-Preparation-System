import mongoose, { Document, Schema, Types } from "mongoose";

export type ReferenceType =
  | "video"
  | "article"
  | "documentation"
  | "problem"
  | "course"
  | "book";

export type SprintDayStatus = "pending" | "in_progress" | "completed";

export interface ISprintDayReference {
  type: ReferenceType;
  title: string;
  url: string;
  source?: string;
  description?: string;
  is_required: boolean;
}

export interface ISprintDay extends Document {
  sprint_id: Types.ObjectId;
  day_number: number;
  scheduled_date: Date;
  topic_title: string;
  topic_description?: string;
  objectives: string[];
  estimated_minutes?: number;
  references: ISprintDayReference[];
  status: SprintDayStatus;
  completed_at: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const referenceSchema = new Schema<ISprintDayReference>(
  {
    type: {
      type: String,
      enum: ["video", "article", "documentation", "problem", "course", "book"],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    source: { type: String, trim: true },
    description: { type: String, trim: true },
    is_required: { type: Boolean, default: true },
  },
  { _id: false },
);

const sprintDaySchema = new Schema<ISprintDay>(
  {
    sprint_id: {
      type: Schema.Types.ObjectId,
      ref: "Sprint",
      required: true,
      index: true,
    },
    day_number: { type: Number, required: true, min: 1 },
    scheduled_date: { type: Date, required: true },
    topic_title: { type: String, required: true, trim: true },
    topic_description: { type: String, trim: true },
    objectives: { type: [String], default: [] },
    estimated_minutes: { type: Number, min: 1 },
    references: { type: [referenceSchema], default: [] },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      default: "pending",
    },
    completed_at: { type: Date, default: null },
  },
  { timestamps: true, collection: "sprint_days" },
);

sprintDaySchema.index({ sprint_id: 1, day_number: 1 }, { unique: true });

export const SprintDay =
  (mongoose.models.SprintDay as mongoose.Model<ISprintDay> | undefined) ??
  mongoose.model<ISprintDay>("SprintDay", sprintDaySchema);
