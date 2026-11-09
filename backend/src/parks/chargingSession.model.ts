import mongoose, { type InferSchemaType } from "mongoose";

const chargingSessionSchema = new mongoose.Schema(
  {
    parkingSessionId: { type: String, required: true },
    spotId: { type: String, required: true },
    vehicleId: { type: String, required: true },
    reservationId: { type: String, required: false },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: false },
    // Energy tracking
    energyConsumed: { type: Number, default: 0 }, // kWh
    // Pricing fields
    baseRatePerKwh: { type: Number, required: true },
    evDiscountPercent: { type: Number, default: 0 },
    finalRatePerKwh: { type: Number },
    totalCost: { type: Number, default: 0 },
    paid: { type: Boolean, default: false },
    paymentMethod: { type: String, enum: ["card", "cash", "mobile"] },
    transactionId: { type: String },
  },
  { timestamps: true },
);

// Index for finding active charging sessions
chargingSessionSchema.index({ vehicleId: 1, endTime: 1 });
// Index for finding sessions by spot
chargingSessionSchema.index({ spotId: 1, startTime: -1 });

export type ChargingSessionSchemaFields = InferSchemaType<
  typeof chargingSessionSchema
>;

export const ChargingSessionModel = mongoose.model(
  "ChargingSession",
  chargingSessionSchema,
);
