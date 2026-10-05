import mongoose, { Document, Schema, Types } from "mongoose";

export type ExperienceLevel = "student" | "fresher" | "experienced";

export interface IUserProfile {
  target_role?: string;
  experience_level?: ExperienceLevel;
  skills: string[];
  github_url?: string;
  resume_url?: string;
}

export interface IUser extends Document {
  googleId?: string;
  email: string;
  name: string;
  password?: string;
  createdAt: Date;
  updatedAt: Date;
  profile: IUserProfile;
  plans: Types.ObjectId[];
}

const profileSchema = new Schema<IUserProfile>(
  {
    target_role: { type: String, trim: true },
    experience_level: {
      type: String,
      enum: ["student", "fresher", "experienced"],
    },
    skills: { type: [String], default: [] },
    github_url: { type: String, trim: true },
    resume_url: { type: String, trim: true },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    googleId: { type: String, unique: true, sparse: true, default: undefined },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    // Google-authenticated accounts do not have a local password.
    password: { type: String, required: false },
    profile: { type: profileSchema, default: () => ({}) },
    plans: [{ type: Schema.Types.ObjectId, ref: "Plan" }],
  },
  { timestamps: true, collection: "users" },
);

export const User =
  (mongoose.models.User as mongoose.Model<IUser> | undefined) ??
  mongoose.model<IUser>("User", userSchema);