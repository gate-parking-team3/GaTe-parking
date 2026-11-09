import mongoose, { type InferSchemaType } from "mongoose";

const parkingSessionSchema = new mongoose.Schema(
  {
    spotId: { type: String, required: true },
    vehicleId: { type: String, required: true },
    reservationId: { type: String, required: false },
    entryTime: { type: Date, required: true },
    exitTime: { type: Date, required: false },
    // Payment fields
    amountDue: { type: Number, default: 0 },
    paid: { type: Boolean, default: false },
    paymentMethod: { type: String, enum: ["card", "cash", "mobile"] },
    transactionId: { type: String },
  },
  { timestamps: true },
);

// Index for finding active sessions
parkingSessionSchema.index({ vehicleId: 1, exitTime: 1 });
// Index for finding sessions by spot
parkingSessionSchema.index({ spotId: 1, entryTime: -1 });

export type ParkingSessionSchemaFields = InferSchemaType<
  typeof parkingSessionSchema
>;

export const ParkingSessionModel = mongoose.model(
  "ParkingSession",
  parkingSessionSchema,
);
