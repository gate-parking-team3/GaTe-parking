// Loads the sample users and vehicles into the development database.
// Usage: npm run seed -w backend
// Safe to run again: records that already exist (same email or plate) are left unchanged.
import { config } from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../auth/password.js";
import { connectDb } from "../db.js";
import { mongoUserStore } from "../users/user.model.js";
import { VehicleModel } from "../vehicles/vehicle.model.js";
import {
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
  console.log(
    `Sample data ready: ${SAMPLE_USERS.length} users, ${SAMPLE_VEHICLES.length} vehicles. Password: ${SAMPLE_PASSWORD}`,
  );
} finally {
  await mongoose.disconnect();
}
