import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  googleId: string;
  email: string;
  name: string;
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model<IUser>("User", userSchema);