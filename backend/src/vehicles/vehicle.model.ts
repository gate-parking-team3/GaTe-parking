import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { VEHICLE_ENGINE_TYPES, VEHICLE_SIZES } from "./vehicle.types.js";

const vehicleSchema = new mongoose.Schema(
  {
    licensePlate: { type: String, required: true, unique: true },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    engineType: {
      type: String,
      required: true,
      enum: VEHICLE_ENGINE_TYPES,
    },
    size: { type: String, required: true, enum: VEHICLE_SIZES },
    userId: { type: String, required: true },
  },
  { versionKey: false },
);

export type VehicleSchemaFields = InferSchemaType<typeof vehicleSchema>;

export const VehicleModel: Model<VehicleSchemaFields> =
  (mongoose.models.Vehicle as Model<VehicleSchemaFields> | undefined) ??
  mongoose.model<VehicleSchemaFields>("Vehicle", vehicleSchema);
