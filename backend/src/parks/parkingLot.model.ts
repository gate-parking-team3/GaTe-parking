import mongoose, { type InferSchemaType, type Model } from "mongoose";

const parkingLotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    address: { type: String, required: true },
    totalCapacity: { type: Number, required: true, min: 0 },
    evCapacity: { type: Number, required: true, min: 0 },
    disabledCapacity: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

export type ParkingLotSchemaFields = InferSchemaType<typeof parkingLotSchema>;

export const ParkingLotModel: Model<ParkingLotSchemaFields> =
  (mongoose.models.ParkingLot as Model<ParkingLotSchemaFields> | undefined) ??
  mongoose.model<ParkingLotSchemaFields>("ParkingLot", parkingLotSchema);
