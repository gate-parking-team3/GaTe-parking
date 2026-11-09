import mongoose, { type InferSchemaType } from "mongoose";

const parkingLotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    address: { type: String, required: true },
    totalCapacity: { type: Number, required: true, min: 0 },
    evCapacity: { type: Number, required: true, min: 0 },
    disabledCapacity: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

export type ParkingLotSchemaFields = InferSchemaType<typeof parkingLotSchema>;

export const ParkingLotModel = mongoose.model("ParkingLot", parkingLotSchema);
