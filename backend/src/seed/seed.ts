// Loads the sample users, vehicles, parking lots and spots into the development database.
// Usage: npm run seed -w backend
// Safe to run again: records that already exist (same email, plate, lot name or spot number) are left unchanged.
import { config } from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../auth/password.js";
import { connectDb } from "../db.js";
import { ParkingLotModel } from "../parks/parkingLot.model.js";
import { ParkingSpotModel } from "../parks/parkingSpot.model.js";
import { mongoUserStore } from "../users/user.model.js";
import { VehicleModel } from "../vehicles/vehicle.model.js";
import {
  SAMPLE_LOTS,
  SAMPLE_PASSWORD,
  SAMPLE_USERS,
  SAMPLE_VEHICLES,
} from "./sample-data.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to load sample data in production");
  process.exit(1);
}

await connectDb(
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/gate-parking",
);
try {
  const passwordHash = await hashPassword(SAMPLE_PASSWORD);
  const userIds = new Map<string, string>();
  for (const { key, ...user } of SAMPLE_USERS) {
    const existing = await mongoUserStore.findByEmail(user.email);
    const saved =
      existing ?? (await mongoUserStore.create({ ...user, passwordHash }));
    userIds.set(key, saved.id);
  }
  for (const { owner, ...vehicle } of SAMPLE_VEHICLES) {
    await VehicleModel.updateOne(
      { licensePlate: vehicle.licensePlate },
      { $setOnInsert: { ...vehicle, userId: userIds.get(owner) } },
      { upsert: true },
    );
  }
  let spotCount = 0;
  for (const { spots, ...lot } of SAMPLE_LOTS) {
    const count = (type: string) => spots.filter((s) => s.type === type).length;
    const saved = await ParkingLotModel.findOneAndUpdate(
      { name: lot.name },
      {
        $setOnInsert: {
          ...lot,
          totalCapacity: spots.length,
          evCapacity: count("ev"),
          disabledCapacity: count("disabled"),
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    for (const spot of spots) {
      await ParkingSpotModel.updateOne(
        { lotId: String(saved._id), spotNumber: spot.spotNumber },
        { $setOnInsert: { ...spot, status: "free" } },
        { upsert: true },
      );
    }
    spotCount += spots.length;
  }
  console.log(
    `Sample data ready: ${SAMPLE_USERS.length} users, ${SAMPLE_VEHICLES.length} vehicles, ${SAMPLE_LOTS.length} lots, ${spotCount} spots. Password: ${SAMPLE_PASSWORD}`,
  );
} finally {
  await mongoose.disconnect();
}
