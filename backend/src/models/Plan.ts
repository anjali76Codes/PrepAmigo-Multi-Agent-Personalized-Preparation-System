import mongoose, { Document, Schema, Types } from "mongoose";

export type PlanStatus = "pending" | "in_progress" | "completed";

export interface IPlan extends Document {
  user_id: Types.ObjectId;
  plan_name: string;
  company: string;
  role: string;
  total_days: number;
  start_date: Date;
  end_date: Date;
  sprints: Types.ObjectId[];
  completion_percent: number;
  status: PlanStatus;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<IPlan>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan_name: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    total_days: { type: Number, required: true, min: 1 },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    sprints: [{ type: Schema.Types.ObjectId, ref: "Sprint" }],
    completion_percent: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      default: "pending",
    },
  },
  { timestamps: true, collection: "plans" },
);

planSchema.index({ user_id: 1, status: 1 });

export const Plan =
  (mongoose.models.Plan as mongoose.Model<IPlan> | undefined) ??
  mongoose.model<IPlan>("Plan", planSchema);
