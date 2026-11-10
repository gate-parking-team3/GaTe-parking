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
let clock: Date;

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
    now: () => clock,
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

const LOTS = [
  {
    id: LOT,
    name: "Main lot",
    address: "Main Street 1",
    totalCapacity: 4,
    evCapacity: 1,
    disabledCapacity: 1,
  },
];

beforeEach(() => {
  clock = NOW;
  store = memoryReservationStore({
    lots: LOTS,
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

describe("POST /api/reservations/:id/start and /end", () => {
  const DURING = new Date("2026-11-10T09:30:00Z");
  const LATER = new Date("2026-11-10T10:15:00Z");

  const book = async (
    userId = ANNA,
    vehicleId = SKODA,
    window = MORNING,
  ): Promise<string> => {
    const res = await reserve(userId, {
      vehicleId,
      spotId: STANDARD.id,
      ...window,
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };
  const start = (rid: string, userId = ANNA, role: User["role"] = "user") =>
    request(appAs(userId, role)).post(`/api/reservations/${rid}/start`);
  const end = (rid: string, userId = ANNA, role: User["role"] = "user") =>
    request(appAs(userId, role)).post(`/api/reservations/${rid}/end`);

  it("starts parking: reservation active, session open, spot busy", async () => {
    const rid = await book();
    clock = DURING;
    const res = await start(rid);
    expect(res.status).toBe(200);
    expect(res.body.reservation).toMatchObject({
      id: rid,
      status: "active",
      ...MORNING,
    });
    expect(res.body.session).toEqual({
      id: expect.any(String),
      spotId: STANDARD.id,
      vehicleId: SKODA,
      reservationId: rid,
      entryTime: DURING.toISOString(),
      exitTime: null,
    });
    const mine = await request(appAs(ANNA)).get(`/api/reservations/${rid}`);
    expect(mine.body.status).toBe("active");
  });

  it("ends parking: reservation completed, exit time recorded, spot free again", async () => {
    const rid = await book();
    clock = DURING;
    await start(rid);
    clock = LATER;
    const res = await end(rid);
    expect(res.status).toBe(200);
    expect(res.body.reservation.status).toBe("completed");
    expect(res.body.session).toMatchObject({
      reservationId: rid,
      entryTime: DURING.toISOString(),
      exitTime: LATER.toISOString(),
    });
    // The rest of the booked window is free again.
    const spots = await available(PETR, {
      vehicleId: PETR_CAR,
      start: LATER.toISOString(),
      end: MORNING.endTime,
    });
    expect(spots.body.spots).toEqual([
      expect.objectContaining({ id: STANDARD.id }),
    ]);
  });

  it("keeps the spot blocked right now while the car stays past the end time", async () => {
    const rid = await book();
    clock = DURING;
    await start(rid);
    clock = new Date("2026-11-10T11:30:00Z");
    const spots = await available(PETR, {
      vehicleId: PETR_CAR,
      start: clock.toISOString(),
      end: "2026-11-10T12:00:00.000Z",
    });
    expect(spots.body.spots).toEqual([]);
    expect((await end(rid)).status).toBe(200);
  });

  it("does not block later bookings of the spot while the car is parked", async () => {
    const rid = await book();
    clock = DURING;
    await start(rid);
    const tomorrow = await reserve(PETR, {
      vehicleId: PETR_CAR,
      spotId: STANDARD.id,
      startTime: "2026-11-11T09:00:00.000Z",
      endTime: "2026-11-11T10:00:00.000Z",
    });
    expect(tomorrow.status).toBe(201);
  });

  it("recovers from a start or an end that stopped halfway", async () => {
    const reservation = (rid: string, status: "reserved" | "active") => ({
      id: rid,
      userId: ANNA,
      vehicleId: SKODA,
      spotId: STANDARD.id,
      lotId: LOT,
      status,
      startTime: new Date(MORNING.startTime),
      endTime: new Date(MORNING.endTime),
    });
    const session = (rid: string, exitTime: Date | null) => ({
      id: id(500),
      spotId: STANDARD.id,
      vehicleId: SKODA,
      reservationId: rid,
      entryTime: new Date("2026-11-10T09:10:00Z"),
      exitTime,
    });
    clock = DURING;

    // Session opened, status still reserved: start reuses the session.
    store = memoryReservationStore({
      lots: LOTS,
      spots: [STANDARD],
      reservations: [reservation(id(400), "reserved")],
      sessions: [session(id(400), null)],
    });
    const started = await start(id(400));
    expect(started.status).toBe(200);
    expect(started.body.session.id).toBe(id(500));
    expect(started.body.reservation.status).toBe("active");

    // Session closed, status still active: end completes the reservation.
    store = memoryReservationStore({
      lots: LOTS,
      spots: [STANDARD],
      reservations: [reservation(id(401), "active")],
      sessions: [session(id(401), DURING)],
    });
    const ended = await end(id(401));
    expect(ended.status).toBe(200);
    expect(ended.body.reservation.status).toBe("completed");
    expect(ended.body.session.exitTime).toBe(DURING.toISOString());
  });

  it("lets only the owner start or end, not other users or admins", async () => {
    const rid = await book();
    clock = DURING;
    expect((await start(rid, PETR)).status).toBe(403);
    expect((await start(rid, ADMIN, "admin")).status).toBe(403);
    await start(rid);
    expect((await end(rid, PETR)).status).toBe(403);
    expect((await end(rid, ADMIN, "admin")).status).toBe(403);
  });

  it("refuses the wrong status", async () => {
    const rid = await book();
    clock = DURING;
    const notStarted = await end(rid);
    expect(notStarted.status).toBe(409);
    expect(notStarted.body).toEqual({
      error: "Only an active reservation can be ended",
    });
    expect((await start(rid)).status).toBe(200);
    expect((await start(rid)).status).toBe(409);
    expect((await end(rid)).status).toBe(200);
    expect((await end(rid)).status).toBe(409);
    expect((await start(rid)).status).toBe(409);
  });

  it("starts only inside the reservation window", async () => {
    const rid = await book();
    clock = new Date("2026-11-10T08:59:59Z");
    const early = await start(rid);
    expect(early.status).toBe(422);
    expect(early.body).toEqual({
      error: "Parking can only start within the reservation window",
    });
    clock = new Date(MORNING.endTime);
    expect((await start(rid)).status).toBe(422);
    clock = new Date(MORNING.startTime);
    expect((await start(rid)).status).toBe(200);
  });

  it("refuses to start while the spot is still occupied by another session", async () => {
    const first = await book(PETR, PETR_CAR);
    const next = await book(ANNA, SKODA, {
      startTime: MORNING.endTime,
      endTime: "2026-11-10T12:00:00.000Z",
    });
    clock = DURING;
    await start(first, PETR);
    // Petr overstays, so Anna cannot check in on the same spot yet.
    clock = new Date("2026-11-10T11:05:00Z");
    const blocked = await start(next);
    expect(blocked.status).toBe(409);
    expect(blocked.body).toEqual({
      error:
        "The spot or the vehicle is already in use by another parking session",
    });
    await end(first, PETR);
    expect((await start(next)).status).toBe(200);
  });

  it("rejects malformed and unknown ids and anonymous callers", async () => {
    expect((await start("x")).status).toBe(400);
    expect((await end(id(999))).status).toBe(404);
    const rid = await book();
    expect(
      (await request(appAs()).post(`/api/reservations/${rid}/start`)).status,
    ).toBe(401);
  });
});
