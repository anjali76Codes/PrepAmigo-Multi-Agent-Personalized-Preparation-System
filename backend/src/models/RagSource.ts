import mongoose, { Document, Schema, Types } from "mongoose";

export interface IRagSource extends Document {
  user_id: Types.ObjectId;
  source_id: string;
  content_hash: string;
}

const ragSourceSchema = new Schema<IRagSource>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    source_id: { type: String, required: true },
    content_hash: { type: String, required: true },
  },
  { timestamps: true, collection: "rag_sources" },
);

ragSourceSchema.index({ user_id: 1, source_id: 1 }, { unique: true });

export const RagSource =
  (mongoose.models.RagSource as mongoose.Model<IRagSource> | undefined) ??
  mongoose.model<IRagSource>("RagSource", ragSourceSchema);
