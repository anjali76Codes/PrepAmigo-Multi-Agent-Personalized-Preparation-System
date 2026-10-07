import mongoose, { Document, Schema, Types } from "mongoose";

export type TrophyKey =
  | "first_sprint"
  | "second_sprint"
  | "third_sprint"
  | "fourth_sprint"
  | "half_sprints"
  | "plan_75_percent"
  | "plan_complete"
  | string;

export interface IProgressTrophy {
  key: string;
  awarded_at: Date;
}

export interface IPlanProgress extends Document {
  user_id: Types.ObjectId;
  plan_id: Types.ObjectId;
  xp_points: number;
  completed_day_ids: Types.ObjectId[];
  completed_day_count: number;
  completed_day_dates: string[];
  weekly_bonus_count: number;
  streak_count: number;
  longest_streak: number;
  last_completed_date: string | null;
  trophies: IProgressTrophy[];
  createdAt: Date;
  updatedAt: Date;
}

const trophySchema = new Schema<IProgressTrophy>(
  {
    key: {
      type: String,
      required: true,
    },
    awarded_at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const planProgressSchema = new Schema<IPlanProgress>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    plan_id: {
      type: Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },
    xp_points: { type: Number, default: 0, min: 0 },
    completed_day_ids: [{ type: Schema.Types.ObjectId, ref: "SprintDay" }],
    completed_day_count: { type: Number, default: 0, min: 0 },
    completed_day_dates: { type: [String], default: [] },
    weekly_bonus_count: { type: Number, default: 0, min: 0 },
    streak_count: { type: Number, default: 0, min: 0 },
    longest_streak: { type: Number, default: 0, min: 0 },
    last_completed_date: { type: String, default: null },
    trophies: { type: [trophySchema], default: [] },
  },
  { timestamps: true, collection: "plan_progress" },
);

planProgressSchema.index({ user_id: 1, plan_id: 1 }, { unique: true });

export const PlanProgress =
  (mongoose.models.PlanProgress as mongoose.Model<IPlanProgress> | undefined) ??
  mongoose.model<IPlanProgress>("PlanProgress", planProgressSchema);