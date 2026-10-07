import mongoose, { Document, Schema, Types } from "mongoose";

export type NotificationType =
  | "reminder"
  | "missed-task"
  | "plan-update"
  | "quiz-result"
  | "streak-warning"
  | "milestone-unlock"
  | "daily-digest";

export interface INotification extends Document {
  user_id: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  reason?: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "reminder",
        "missed-task",
        "plan-update",
        "quiz-result",
        "streak-warning",
        "milestone-unlock",
        "daily-digest",
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    reason: { type: String, trim: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "notifications" },
);

notificationSchema.index({ user_id: 1, createdAt: -1 });

export const Notification =
  (mongoose.models.Notification as mongoose.Model<INotification> | undefined) ??
  mongoose.model<INotification>("Notification", notificationSchema);
