import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const NOTIFICATION_TYPES = [
  "start_soon",
  "end_soon",
  "cancelled",
  "deleted",
  "spot_unavailable",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    reservationId: { type: String, required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, required: true },
    readAt: { type: Date, default: null },
  },
  { versionKey: false },
);
// Guarantees one notification per type and reservation even if two workers overlap.
notificationSchema.index({ reservationId: 1, type: 1 }, { unique: true });
notificationSchema.index({ userId: 1, createdAt: -1 });

const notificationSettingsSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    start_soon: { type: Boolean, default: true },
    end_soon: { type: Boolean, default: true },
    cancelled: { type: Boolean, default: true },
    deleted: { type: Boolean, default: true },
    spot_unavailable: { type: Boolean, default: true },
  },
  { versionKey: false },
);

export type NotificationSchemaFields = InferSchemaType<
  typeof notificationSchema
>;
export type NotificationSettingsSchemaFields = InferSchemaType<
  typeof notificationSettingsSchema
>;

export const NotificationModel: Model<NotificationSchemaFields> =
  (mongoose.models.Notification as
    Model<NotificationSchemaFields> | undefined) ??
  mongoose.model<NotificationSchemaFields>("Notification", notificationSchema);
export const NotificationSettingsModel: Model<NotificationSettingsSchemaFields> =
  (mongoose.models.NotificationSettings as
    Model<NotificationSettingsSchemaFields> | undefined) ??
  mongoose.model<NotificationSettingsSchemaFields>(
    "NotificationSettings",
    notificationSettingsSchema,
  );
