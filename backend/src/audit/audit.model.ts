import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { AUDIT_ACTION_TYPES } from "./audit.types.js";

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    action: { type: String, required: true },
    actionType: {
      type: String,
      enum: AUDIT_ACTION_TYPES,
      required: true,
    },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ actionType: 1, createdAt: -1 });

export type AuditLogSchemaFields = InferSchemaType<typeof auditLogSchema>;

export const AuditLogModel: Model<AuditLogSchemaFields> =
  (mongoose.models.AuditLog as Model<AuditLogSchemaFields> | undefined) ??
  mongoose.model<AuditLogSchemaFields>("AuditLog", auditLogSchema);
