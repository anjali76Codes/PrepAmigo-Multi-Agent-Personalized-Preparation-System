import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAuditLog extends Document {
  user_id?: Types.ObjectId;
  action: string;
  email?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  userAgent?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    ip_address: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true, collection: "audit_logs" }
);

auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog =
  (mongoose.models.AuditLog as mongoose.Model<IAuditLog> | undefined) ??
  mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
