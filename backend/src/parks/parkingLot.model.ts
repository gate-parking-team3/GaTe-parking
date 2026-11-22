import mongoose, { type InferSchemaType, type Model } from "mongoose";

const parkingLotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    address: { type: String, required: true },
    totalCapacity: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        // EV and disabled spots are part of the total, so together they cannot exceed it.
        validator: function (this: unknown, total: number) {
          if (!(this instanceof mongoose.Document)) return true;
          const ev = Number(this.get("evCapacity") ?? 0);
          const disabled = Number(this.get("disabledCapacity") ?? 0);
          return ev + disabled <= total;
        },
        message: "evCapacity + disabledCapacity cannot exceed totalCapacity",
      },
    },
    evCapacity: { type: Number, required: true, min: 0 },
    disabledCapacity: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

export type ParkingLotSchemaFields = InferSchemaType<typeof parkingLotSchema>;

export const ParkingLotModel: Model<ParkingLotSchemaFields> =
  (mongoose.models.ParkingLot as Model<ParkingLotSchemaFields> | undefined) ??
  mongoose.model<ParkingLotSchemaFields>("ParkingLot", parkingLotSchema);
