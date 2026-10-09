import mongoose, { Document, Schema, Types } from "mongoose";

export interface ICustomTask extends Document {
  user_id: Types.ObjectId;
  plan_id?: Types.ObjectId;
  sprint_id: string;
  title: string;
  description: string;
  scheduled_date: Date;
  estimated_minutes: number;
  status: "pending" | "in_progress" | "completed";
  completed_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const customTaskSchema = new Schema<ICustomTask>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan_id: {
      type: Schema.Types.ObjectId,
      ref: "Plan",
      required: false,
    },
    sprint_id: {
      type: String,
      default: "custom",
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    scheduled_date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    estimated_minutes: {
      type: Number,
      default: 30,
      min: 1,
      max: 600,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      default: "pending",
    },
    completed_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, collection: "custom_tasks" }
);

customTaskSchema.index({ user_id: 1, scheduled_date: 1 });

export const CustomTask =
  (mongoose.models.CustomTask as mongoose.Model<ICustomTask> | undefined) ??
  mongoose.model<ICustomTask>("CustomTask", customTaskSchema);
