import mongoose, { type InferSchemaType, type Model } from "mongoose";

const parkingSessionSchema = new mongoose.Schema(
  {
    spotId: { type: String, required: true },
    vehicleId: { type: String, required: true },
    reservationId: { type: String, required: false },
    entryTime: { type: Date, required: true },
    // null while the car is parked; set when the session ends.
    exitTime: {
      type: Date,
      default: null,
      validate: {
        validator: function (this: unknown, exit: Date | null) {
          if (exit === null || !(this instanceof mongoose.Document))
            return true;
          const entry = this.get("entryTime") as Date | undefined;
          return !entry || exit > entry;
        },
        message: "exitTime must be after entryTime",
      },
    },
  },
  { timestamps: true, versionKey: false },
);

// A vehicle and a spot can each have only one active (not ended) session.
const ACTIVE_SESSION = { exitTime: { $type: "null" } };
parkingSessionSchema.index(
  { vehicleId: 1 },
  { unique: true, partialFilterExpression: ACTIVE_SESSION },
);
parkingSessionSchema.index(
  { spotId: 1 },
  { unique: true, partialFilterExpression: ACTIVE_SESSION },
);
// Session history by vehicle and by spot
parkingSessionSchema.index({ vehicleId: 1, entryTime: -1 });
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
