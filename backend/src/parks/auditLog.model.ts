import mongoose, { type InferSchemaType } from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: String, required: false },
    action: {
      type: String,
      required: true,
      enum: [
        "parking_spot_created",
        "parking_spot_updated",
        "parking_spot_deleted",
        "reservation_created",
        "reservation_updated",
        "reservation_deleted",
        "user_registered",
        "user_updated",
        "user_disabled",
        "gate_entry",
        "gate_exit",
      ],
    },
    resourceId: { type: String, required: false }, // ID of affected resource
    resourceType: { type: String, required: false }, // Type of affected resource
    details: { type: mongoose.Schema.Types.Mixed }, // Additional context data
    ipAddress: { type: String },
    userAgent: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Index for finding recent audit logs
auditLogSchema.index({ createdAt: -1 });
// Index for finding logs by user
auditLogSchema.index({ userId: 1, createdAt: -1 });
// Index for finding logs by resource
auditLogSchema.index({ resourceId: 1, resourceType: 1 });

export type AuditLogSchemaFields = InferSchemaType<typeof auditLogSchema>;

export const AuditLogModel = mongoose.model("AuditLog", auditLogSchema);
