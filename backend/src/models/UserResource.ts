import mongoose, { Document, Schema, Types } from "mongoose";

export type UserResourceKind = "folder" | "file";

export interface IUserResource extends Document {
  user_id: Types.ObjectId;
  parent_id: string;
  title: string;
  kind: UserResourceKind;
  content: string;
  url: string;
  icon: string;
  legacy_id?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userResourceSchema = new Schema<IUserResource>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    parent_id: { type: String, default: "root", trim: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    kind: { type: String, enum: ["folder", "file"], required: true },
    content: { type: String, default: "", maxlength: 100000 },
    url: { type: String, default: "", trim: true, maxlength: 2048 },
    icon: { type: String, default: "document-text", trim: true, maxlength: 80 },
    legacy_id: { type: String, trim: true, maxlength: 160 },
  },
  { timestamps: true, collection: "user_resources" },
);

userResourceSchema.index({ user_id: 1, parent_id: 1 });
userResourceSchema.index(
  { user_id: 1, legacy_id: 1 },
  { unique: true, partialFilterExpression: { legacy_id: { $type: "string" } } },
);

export const UserResource =
  (mongoose.models.UserResource as mongoose.Model<IUserResource> | undefined) ??
  mongoose.model<IUserResource>("UserResource", userResourceSchema);
