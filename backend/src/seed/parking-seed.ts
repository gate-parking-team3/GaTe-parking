// Generates synthetic parking data (lots, spots, reservations, sessions)
// Usage: npm run seed:parking -w backend
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { connectDb } from "../db.js";
import { ParkingLotModel } from "../parks/parkingLot.model.js";
import { ParkingSpotModel } from "../parks/parkingSpot.model.js";
import { ParkingSessionModel } from "../parks/parkingSession.model.js";
import { ReservationModel } from "../parks/reservation.model.js";
import { VehicleModel } from "../vehicles/vehicle.model.js";
import { mongoUserStore } from "../users/user.model.js";
import { SAMPLE_USERS } from "./sample-data.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed data in production");
  process.exit(1);
}

// Simple pseudo-random number generator for consistent synthetic data
class SimpleFaker {
  private seed: number;

  constructor(seed: number = 42) {
    this.seed = seed;
  }

  private next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed;
  }

  number(min: number, max: number): number {
    return Math.floor((this.next() / 0x7fffffff) * (max - min + 1)) + min;
  }

  float(min: number, max: number): number {
    return (this.next() / 0x7fffffff) * (max - min) + min;
  }

  pick<T>(items: T[]): T {
    return items[this.number(0, items.length - 1)];
  }

  string(
    length: number,
    chars: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  ): string {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars[this.number(0, chars.length - 1)];
    }
    return result;
  }

  // City names for addresses
  city: string[] = [
    "Praha",
    "Brno",
    "Ostrava",
    "Plze",
    "Liberec",
    "Olomouc",
    "Mlada Boleslav",
    "Kladno",
  ];

  streetNames: string[] = [
    "Na Vinicích",
    "U Kotce",
    "Na Holánkách",
    "U Komunikace",
    "V Kopeštině",
    "Na Zdenčině",
    "U Vodovec",
    "Na Vinohradách",
    "Radnické náměstí",
    "Hlavní nádraží",
    "Studentinská",
    "Dělnická",
    "Sokolovská",
    "Husova",
  ];

  companyName: string[] = [
    "Centrum",
    "Město",
    "Velký hřebec",
    "Park&Go",
    "Parkový dvůr",
  ];
}

const faker = new SimpleFaker();

// Generate parking lots
function generateParkingLots(count: number): Array<Record<string, unknown>> {
  const lots: Array<Record<string, unknown>> = [];

  for (let i = 0; i < count; i++) {
    const capacity = faker.number(50, 500);
    const evCapacity = Math.floor(capacity * faker.float(0.05, 0.2));
    const disabledCapacity = Math.floor(capacity * faker.float(0.02, 0.05));

    lots.push({
      name: `Parkovací dům ${faker.companyName[i % faker.companyName.length]} ${i + 1}`,
      address: `${faker.streetNames[i % faker.streetNames.length]} ${faker.number(1, 150)}, ${faker.city[i % faker.city.length]} ${faker.number(100, 999)}${faker.number(0, 99)}`,
      totalCapacity: capacity,
      evCapacity,
      disabledCapacity,
    });
  }

  return lots;
}

// Generate parking spots
function generateParkingSpots(
  lots: Array<Record<string, unknown>>,
  spotsPerLot: number,
): Array<Record<string, unknown>> {
  const spots: Array<Record<string, unknown>> = [];

  for (const lot of lots) {
    const lotId = lot._id?.toString();
    if (!lotId) {
      console.log(`Skipping lot without _id: ${lot.name}`);
      continue;
    }

    const totalCapacity = Number(lot.totalCapacity) || 100;
    const evCapacity = Number(lot.evCapacity) || 10;
    const disabledCapacity = Number(lot.disabledCapacity) || 5;

    let spotNumber = 1;
    for (let i = 0; i < spotsPerLot; i++) {
      let type: "standard" | "disabled" | "ev" = "standard";
      if (i < disabledCapacity) {
        type = "disabled";
      } else if (i >= disabledCapacity && i < disabledCapacity + evCapacity) {
        type = "ev";
      }

      const size = ["small", "standard", "large"][faker.number(0, 2)];

      spots.push({
        spotNumber: String(spotNumber++),
        lotId,
        type,
        size,
      });
    }
  }

  return spots;
}

// Generate reservations
function generateReservations(
  users: typeof SAMPLE_USERS,
  vehicles: Array<Record<string, unknown>>,
  parkingSpots: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const reservations: Array<Record<string, unknown>> = [];
  const now = new Date();

  const reservationCount = Math.floor(parkingSpots.length * 0.6);

  for (let i = 0; i < reservationCount; i++) {
    const user = users[faker.number(0, users.length - 1)];
    const userVehicles = vehicles.filter((v) => v.userId === user.id);
    const vehicle = userVehicles[faker.number(0, userVehicles.length - 1)];
    const spot = parkingSpots[faker.number(0, parkingSpots.length - 1)];

    const durationHours = faker.number(1, 8);
    const offsetHours = faker.number(-48, 48);

    const startTime = new Date(now.getTime() - offsetHours * 60 * 60 * 1000);
    const endTime = new Date(
      startTime.getTime() + durationHours * 60 * 60 * 1000,
    );

    reservations.push({
      userId: user.id,
      vehicleId: vehicle._id,
      spotId: spot.spotNumber,
      lotId: spot.lotId,
      status: "reserved",
      startTime,
      endTime,
    });
  }

  return reservations;
}

// Generate parking sessions
function generateParkingSessions(
  reservations: Array<Record<string, unknown>>,
  parkingSpots: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const sessions: Array<Record<string, unknown>> = [];
  const now = new Date();

  for (const reservation of reservations) {
    const spot = parkingSpots.find((s) => s.spotNumber === reservation.spotId);

    if (spot) {
      const entryOffset = faker.number(10, 60);
      const entryTime = new Date(
        reservation.startTime.getTime() - entryOffset * 60 * 1000,
      );

      const isCompleted = reservation.endTime < now;
      const exitOffset = faker.number(10, 60);

      const session: Record<string, unknown> = {
        spotId: spot.spotNumber,
        vehicleId: reservation.vehicleId,
        reservationId: reservation._id,
        entryTime,
      };

      if (isCompleted) {
        session.exitTime = new Date(
          reservation.endTime.getTime() + exitOffset * 60 * 1000,
        );
      }

      sessions.push(session);
    }
  }

  return sessions;
}

async function main() {
  await connectDb(
    process.env.MONGODB_URI ?? "mongodb://localhost:27017/gate-parking",
  );

  try {
    // Get users and vehicles from database
    const users = await mongoUserStore.list();
    const vehiclesDocs = await VehicleModel.find().exec();

    // Build vehicle map by userId
    const vehicleMap = new Map<string, Array<Record<string, unknown>>>();
    for (const vehicle of vehiclesDocs) {
      const userId = vehicle.userId?.toString();
      if (userId) {
        const list = vehicleMap.get(userId) || [];
        list.push({
          _id: vehicle._id,
          licensePlate: vehicle.licensePlate,
          brand: vehicle.brand,
          model: vehicle.model,
          engineType: vehicle.engineType,
          size: vehicle.size,
          userId: userId,
        });
        vehicleMap.set(userId, list);
      }
    }

    // Insert parking lots
    const lots = generateParkingLots(3);
    const insertedLots: Array<Record<string, unknown>> = [];

    for (const lot of lots) {
      const existing = await ParkingLotModel.findOne({ name: lot.name });
      if (!existing) {
        const newLot = await ParkingLotModel.create(lot);
        insertedLots.push(newLot);
        console.log(`Created lot: ${newLot.name} (${newLot._id})`);
      } else {
        insertedLots.push(existing);
      }
    }

    console.log(`Total lots: ${insertedLots.length}`);

    // Insert parking spots
    const allSpots = generateParkingSpots(insertedLots, 40);
    const insertedSpots: Array<Record<string, unknown>> = [];

    for (const spot of allSpots) {
      const existing = await ParkingSpotModel.findOne({
        lotId: spot.lotId,
        spotNumber: spot.spotNumber,
      });
      if (!existing) {
        const newSpot = await ParkingSpotModel.create(spot);
        insertedSpots.push(newSpot);
      }
    }

    console.log(`Created ${insertedSpots.length} parking spots`);

    // Insert reservations
    const allReservations = generateReservations(
      SAMPLE_USERS,
      vehiclesDocs,
      insertedSpots,
    );
    const insertedReservations: Array<Record<string, unknown>> = [];

    for (const res of allReservations) {
      const existing = await ReservationModel.findOne({
        userId: res.userId,
        vehicleId: res.vehicleId,
        spotId: res.spotId,
        startTime: res.startTime,
      });
      if (!existing) {
        const newRes = await ReservationModel.create(res);
        insertedReservations.push(newRes);
      }
    }

    console.log(`Created ${insertedReservations.length} reservations`);

    // Insert parking sessions
    const allSessions = generateParkingSessions(
      insertedReservations,
      insertedSpots,
    );
    const insertedSessions: Array<Record<string, unknown>> = [];

    for (const session of allSessions) {
      const existing = await ParkingSessionModel.findOne({
        spotId: session.spotId,
        vehicleId: session.vehicleId,
        entryTime: session.entryTime,
      });
      if (!existing) {
        const newSession = await ParkingSessionModel.create(session);
        insertedSessions.push(newSession);
      }
    }

    console.log(`Created ${insertedSessions.length} parking sessions`);

    console.log("\nParkování data seeded successfully!");
    console.log(`  - Parking lots: ${insertedLots.length}`);
    console.log(`  - Parking spots: ${insertedSpots.length}`);
    console.log(`  - Reservations: ${insertedReservations.length}`);
    console.log(`  - Parking sessions: ${insertedSessions.length}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("Error seeding parking data:", err);
  process.exit(1);
});
