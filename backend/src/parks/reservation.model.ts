import mongoose, { type InferSchemaType } from "mongoose";
import { RESERVATION_STATUSES } from "./reservation.types.js";

const reservationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    vehicleId: { type: String, required: true },
    spotId: { type: String, required: true },
    lotId: { type: String, required: true },
    status: {
      type: String,
      enum: RESERVATION_STATUSES,
      default: "reserved",
      required: true,
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Index for finding active reservations for a vehicle at a given time
reservationSchema.index({ vehicleId: 1, status: 1, startTime: 1, endTime: 1 });
// Index for finding reservations for a spot
reservationSchema.index({ spotId: 1, status: 1, startTime: 1, endTime: 1 });
// Index for finding reservations by user
reservationSchema.index({ userId: 1, createdAt: -1 });

export type ReservationSchemaFields = InferSchemaType<typeof reservationSchema>;

export const ReservationModel = mongoose.model(
  "Reservation",
  reservationSchema,
);
