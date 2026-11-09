import mongoose, { type InferSchemaType } from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: [
        "reservation_starting_soon",
        "reservation_ending_soon",
        "reservation_cancelled",
        "spot_unavailable",
        "payment_completed",
        "general",
      ],
    },
    reservationId: { type: String, required: false },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Index for finding unread notifications
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
// Index for finding notifications by reservation
notificationSchema.index({ reservationId: 1 });

export type NotificationSchemaFields = InferSchemaType<
  typeof notificationSchema
>;

export const NotificationModel = mongoose.model(
  "Notification",
  notificationSchema,
);
