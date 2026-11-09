import mongoose, { type InferSchemaType, type Model } from "mongoose";

const parkingSessionSchema = new mongoose.Schema(
  {
    spotId: { type: String, required: true },
    vehicleId: { type: String, required: true },
    reservationId: { type: String, required: false },
    entryTime: { type: Date, required: true },
    exitTime: { type: Date, required: false },
  },
  { timestamps: true, versionKey: false },
);

// Index for finding active sessions
parkingSessionSchema.index({ vehicleId: 1, exitTime: 1 });
// Index for finding sessions by spot
parkingSessionSchema.index({ spotId: 1, entryTime: -1 });

export type ParkingSessionSchemaFields = InferSchemaType<
  typeof parkingSessionSchema
>;

export const ParkingSessionModel: Model<ParkingSessionSchemaFields> =
  (mongoose.models.ParkingSession as
    Model<ParkingSessionSchemaFields> | undefined) ??
  mongoose.model<ParkingSessionSchemaFields>(
    "ParkingSession",
    parkingSessionSchema,
  );
