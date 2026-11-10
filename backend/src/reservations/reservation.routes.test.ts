import express, { type RequestHandler } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { ParkingSpotRecord } from "../parks/parkingSpot.types.js";
import type { User } from "../users/user.js";
import type { VehicleRepository } from "../vehicles/vehicle.repository.js";
import type { VehicleRecord } from "../vehicles/vehicle.types.js";
import { memoryReservationStore } from "./memory-reservation-store.js";
import {
  createLotRouter,
  createReservationRouter,
} from "./reservation.routes.js";
import type { ReservationStore } from "./reservation.store.js";

const id = (n: number) => n.toString(16).padStart(24, "0");
const LOT = id(1);
const ANNA = id(10);
const PETR = id(11);
const ADMIN = id(12);
const SKODA = id(20); // Anna, combustion, standard
const TESLA = id(21); // Anna, electric, standard
const PETR_CAR = id(22); // Petr, combustion, standard

const spot = (
  n: number,
  type: ParkingSpotRecord["type"],
  size: ParkingSpotRecord["size"],
): ParkingSpotRecord => ({
  id: id(100 + n),
  spotNumber: `A${n}`,
  lotId: LOT,
  type,
  size,
  status: "free",
});
const STANDARD = spot(1, "standard", "standard");
const SMALL = spot(2, "standard", "small");
const EV = spot(3, "ev", "standard");
const DISABLED = spot(4, "disabled", "large");

const vehicle = (
  vid: string,
  userId: string,
  engineType: VehicleRecord["engineType"],
): VehicleRecord => ({
  id: vid,
  licensePlate: vid.slice(-7),
  brand: "Brand",
  model: "Model",
  engineType,
  size: "standard",
  userId,
});

const fakeVehicles = (records: VehicleRecord[]): VehicleRepository => ({
  async findById(vid) {
    return records.find((v) => v.id === vid) ?? null;
  },
  listByOwner: () => Promise.reject(new Error("unused")),
  create: () => Promise.reject(new Error("unused")),
  update: () => Promise.reject(new Error("unused")),
  deleteById: () => Promise.reject(new Error("unused")),
});

const NOW = new Date("2026-11-10T08:00:00Z");
const MORNING = {
  startTime: "2026-11-10T09:00:00.000Z",
  endTime: "2026-11-10T11:00:00.000Z",
};

let store: ReservationStore;

function appAs(userId?: string, role: User["role"] = "user") {
  const signIn: RequestHandler = (req, _res, next) => {
    if (userId) Object.assign(req, { user: { id: userId, role } });
    next();
  };
  const deps = {
    store,
    vehicles: fakeVehicles([
      vehicle(SKODA, ANNA, "combustion"),
      vehicle(TESLA, ANNA, "electric"),
      vehicle(PETR_CAR, PETR, "combustion"),
    ]),
    now: () => NOW,
  };
  const app = express();
  app.use(express.json());
  app.use(signIn);
  app.use("/api/lots", createLotRouter(deps));
  app.use("/api/reservations", createReservationRouter(deps));
  return app;
}

const reserve = (
  userId: string,
  body: Record<string, unknown>,
): Promise<request.Response> =>
  request(appAs(userId)).post("/api/reservations").send(body);

const available = (
  userId: string,
  query: Record<string, string>,
): Promise<request.Response> =>
  request(appAs(userId))
    .get(`/api/lots/${LOT}/available-spots`)
    .query({ start: MORNING.startTime, end: MORNING.endTime, ...query });

beforeEach(() => {
  store = memoryReservationStore({
    lots: [
      {
        id: LOT,
        name: "Main lot",
        address: "Main Street 1",
        totalCapacity: 4,
        evCapacity: 1,
        disabledCapacity: 1,
      },
    ],
    spots: [STANDARD, SMALL, EV, DISABLED],
  });
});

describe("GET /api/lots", () => {
  it("lists the parking lots", async () => {
    const res = await request(appAs(ANNA)).get("/api/lots");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: LOT })]);
  });
});

describe("GET /api/lots/:lotId/available-spots", () => {
  const spotIds = (res: request.Response) =>
    (res.body.spots as { id: string }[]).map((s) => s.id);

  it("offers a combustion car only standard spots it fits into", async () => {
    const res = await available(ANNA, { vehicleId: SKODA });
    expect(res.status).toBe(200);
    expect(spotIds(res)).toEqual([STANDARD.id]);
  });

  it("offers an electric car EV and standard spots, and EV only with the filter", async () => {
    expect(spotIds(await available(ANNA, { vehicleId: TESLA }))).toEqual([
      STANDARD.id,
      EV.id,
    ]);
    expect(
      spotIds(await available(ANNA, { vehicleId: TESLA, evOnly: "true" })),
    ).toEqual([EV.id]);
  });

  it("hides spots booked in an overlapping window but not in a touching one", async () => {
    await reserve(PETR, {
      vehicleId: PETR_CAR,
      spotId: STANDARD.id,
      ...MORNING,
    });
    expect(spotIds(await available(ANNA, { vehicleId: TESLA }))).toEqual([
      EV.id,
    ]);
    const afterwards = await available(ANNA, {
      vehicleId: TESLA,
      start: MORNING.endTime,
      end: "2026-11-10T12:00:00.000Z",
    });
    expect(spotIds(afterwards)).toEqual([STANDARD.id, EV.id]);
  });

  it("rejects someone else's vehicle, an unknown lot and a bad window", async () => {
    expect((await available(PETR, { vehicleId: SKODA })).status).toBe(404);
    const unknownLot = await request(appAs(ANNA))
      .get(`/api/lots/${id(999)}/available-spots`)
      .query({
        vehicleId: SKODA,
        start: MORNING.startTime,
        end: MORNING.endTime,
      });
    expect(unknownLot.status).toBe(404);
    const backwards = await available(ANNA, {
      vehicleId: SKODA,
      start: MORNING.endTime,
      end: MORNING.startTime,
    });
    expect(backwards.status).toBe(400);
    expect(backwards.body).toEqual({ error: "End must be after start" });
    expect((await available(ANNA, { vehicleId: "nope" })).status).toBe(400);
  });

  it("requires a signed-in user", async () => {
    const res = await request(appAs())
      .get(`/api/lots/${LOT}/available-spots`)
      .query({ vehicleId: SKODA, ...MORNING });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/reservations", () => {
  it("creates a reserved reservation for the caller", async () => {
    const res = await reserve(ANNA, {
      vehicleId: SKODA,
      spotId: STANDARD.id,
      ...MORNING,
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      userId: ANNA,
      vehicleId: SKODA,
      spotId: STANDARD.id,
      lotId: LOT,
      status: "reserved",
      ...MORNING,
    });
  });

  it("refuses a second booking of the same spot in an overlapping window", async () => {
    await reserve(ANNA, { vehicleId: SKODA, spotId: STANDARD.id, ...MORNING });
    const sameSpot = await reserve(PETR, {
      vehicleId: PETR_CAR,
      spotId: STANDARD.id,
      startTime: "2026-11-10T10:00:00.000Z",
      endTime: "2026-11-10T12:00:00.000Z",
    });
    expect(sameSpot.status).toBe(409);
    // Back-to-back bookings are fine.
    const next = await reserve(PETR, {
      vehicleId: PETR_CAR,
      spotId: STANDARD.id,
      startTime: MORNING.endTime,
      endTime: "2026-11-10T12:00:00.000Z",
    });
    expect(next.status).toBe(201);
  });

  it("refuses the same vehicle on two spots at once", async () => {
    await reserve(ANNA, { vehicleId: TESLA, spotId: EV.id, ...MORNING });
    const res = await reserve(ANNA, {
      vehicleId: TESLA,
      spotId: STANDARD.id,
      ...MORNING,
    });
    expect(res.status).toBe(409);
  });

  it("refuses an unsuitable spot", async () => {
    for (const spotId of [EV.id, DISABLED.id, SMALL.id]) {
      const res = await reserve(ANNA, { vehicleId: SKODA, spotId, ...MORNING });
      expect(res.status).toBe(422);
    }
  });

  it("refuses someone else's vehicle and unknown or malformed ids", async () => {
    expect(
      (
        await reserve(PETR, {
          vehicleId: SKODA,
          spotId: STANDARD.id,
          ...MORNING,
        })
      ).status,
    ).toBe(404);
    expect(
      (await reserve(ANNA, { vehicleId: SKODA, spotId: id(999), ...MORNING }))
        .status,
    ).toBe(404);
    expect(
      (await reserve(ANNA, { vehicleId: "x", spotId: STANDARD.id, ...MORNING }))
        .status,
    ).toBe(400);
  });

  it("refuses an invalid time window", async () => {
    const res = await reserve(ANNA, {
      vehicleId: SKODA,
      spotId: STANDARD.id,
      startTime: "2026-11-09T09:00:00.000Z",
      endTime: "2026-11-09T11:00:00.000Z",
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Start cannot be in the past" });
  });
});

describe("GET /api/reservations", () => {
  it("lists only the caller's reservations at /mine", async () => {
    await reserve(ANNA, { vehicleId: SKODA, spotId: STANDARD.id, ...MORNING });
    await reserve(PETR, {
      vehicleId: PETR_CAR,
      spotId: STANDARD.id,
      startTime: MORNING.endTime,
      endTime: "2026-11-10T12:00:00.000Z",
    });
    const res = await request(appAs(ANNA)).get("/api/reservations/mine");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].userId).toBe(ANNA);
  });

  it("shows one reservation to its owner and admins only", async () => {
    const created = await reserve(ANNA, {
      vehicleId: SKODA,
      spotId: STANDARD.id,
      ...MORNING,
    });
    const path = `/api/reservations/${created.body.id}`;
    expect((await request(appAs(ANNA)).get(path)).status).toBe(200);
    expect((await request(appAs(ADMIN, "admin")).get(path)).status).toBe(200);
    expect((await request(appAs(PETR)).get(path)).status).toBe(403);
    expect(
      (await request(appAs(ANNA)).get(`/api/reservations/${id(999)}`)).status,
    ).toBe(404);
    expect((await request(appAs(ANNA)).get("/api/reservations/x")).status).toBe(
      400,
    );
  });
});
