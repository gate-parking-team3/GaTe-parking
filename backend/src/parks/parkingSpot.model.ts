import mongoose, { type InferSchemaType } from "mongoose";
import {
  PARKING_SPOT_SIZES,
  PARKING_SPOT_STATUSES,
  PARKING_SPOT_TYPES,
} from "./parkingSpot.types.js";

const parkingSpotSchema = new mongoose.Schema(
  {
    spotNumber: { type: String, required: true },
    lotId: { type: String, required: true },
    type: {
      type: String,
      enum: PARKING_SPOT_TYPES,
      required: true,
    },
    size: {
      type: String,
      enum: PARKING_SPOT_SIZES,
      required: true,
    },
    status: {
      type: String,
      enum: PARKING_SPOT_STATUSES,
      default: "free",
      required: true,
    },
  },
  { timestamps: true },
);

parkingSpotSchema.index({ lotId: 1, spotNumber: 1 }, { unique: true });

export type ParkingSpotSchemaFields = InferSchemaType<typeof parkingSpotSchema>;

export const ParkingSpotModel = mongoose.model(
  "ParkingSpot",
  parkingSpotSchema,
);
