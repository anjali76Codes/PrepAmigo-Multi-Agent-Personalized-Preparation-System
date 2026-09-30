import mongoose, { Document, Schema, Types } from "mongoose";

export type SprintStatus = "pending" | "in_progress" | "completed";

export interface ISprint extends Document {
  plan_id: Types.ObjectId;
  sprint_number: number;
  sprint_name: string;
  start_date: Date;
  end_date: Date;
  total_days: number;
  sprint_days: Types.ObjectId[];
  completion_percent: number;
  status: SprintStatus;
  createdAt: Date;
  updatedAt: Date;
}

const sprintSchema = new Schema<ISprint>(
  {
    plan_id: {
      type: Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
      index: true,
    },
    sprint_number: { type: Number, required: true, min: 1 },
    sprint_name: { type: String, required: true, trim: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    total_days: { type: Number, required: true, min: 1 },
    sprint_days: [{ type: Schema.Types.ObjectId, ref: "SprintDay" }],
    completion_percent: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      default: "pending",
    },
  },
  { timestamps: true, collection: "sprints" },
);

sprintSchema.index({ plan_id: 1, sprint_number: 1 }, { unique: true });

export const Sprint =
  (mongoose.models.Sprint as mongoose.Model<ISprint> | undefined) ??
  mongoose.model<ISprint>("Sprint", sprintSchema);
