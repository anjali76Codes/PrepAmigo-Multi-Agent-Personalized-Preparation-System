import mongoose, { Document, Schema, Types } from "mongoose";

export interface IChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    source_id: string;
    title: string;
    source_type: string;
    folder_path: string;
    url: string;
  }>;
  createdAt: Date;
}

export interface IChatSession extends Document {
  user_id: Types.ObjectId;
  title: string;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    sources: [
      {
        source_id: { type: String },
        title: { type: String },
        source_type: { type: String },
        folder_path: { type: String },
        url: { type: String },
      },
    ],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const chatSessionSchema = new Schema<IChatSession>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: "New Chat",
    },
    messages: {
      type: [chatMessageSchema],
      default: [],
    },
  },
  { timestamps: true, collection: "chat_sessions" }
);

chatSessionSchema.index({ user_id: 1, updatedAt: -1 });

export const ChatSession =
  (mongoose.models.ChatSession as mongoose.Model<IChatSession> | undefined) ??
  mongoose.model<IChatSession>("ChatSession", chatSessionSchema);
