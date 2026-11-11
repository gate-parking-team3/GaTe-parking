import express, { type RequestHandler } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { ReservationRecord } from "../parks/reservation.types.js";
import { memoryReservationStore } from "./memory-reservation-store.js";
import { createReservationRouter } from "./reservation.routes.js";
import type { ReservationStore } from "./reservation.store.js";
import type { VehicleRepository } from "../vehicles/vehicle.repository.js";

const id = (n: number) => n.toString(16).padStart(24, "0");
const LOT = id(1);
const OWNER = id(2);
const OTHER = id(3);
const ADMIN = id(4);
const VEHICLE = id(5);
const SPOT = id(6);
const RESERVATION = id(7);
const NOW = new Date("2026-11-10T08:00:00.000Z");
const START = new Date("2026-11-10T09:00:00.000Z");
const END = new Date("2026-11-10T11:00:00.000Z");

const booking = (
  status: ReservationRecord["status"] = "reserved",
): ReservationRecord => ({
  id: RESERVATION,
  userId: OWNER,
  vehicleId: VEHICLE,
  spotId: SPOT,
  lotId: LOT,
  status,
  startTime: START,
  endTime: END,
});

const unusedVehicles: VehicleRepository = {
  findById: async () => null,
  listByOwner: async () => [],
  create: async () => {
    throw new Error("not used");
  },
  update: async () => {
    throw new Error("not used");
  },
  deleteById: async () => false,
};

let store: ReservationStore;

function appAs(userId?: string, role: "user" | "admin" = "user") {
  const signIn: RequestHandler = (req, _res, next) => {
    if (userId) Object.assign(req, { user: { id: userId, role } });
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(signIn);
  app.use(
    "/api/reservations",
    createReservationRouter({
      store,
      vehicles: unusedVehicles,
      now: () => NOW,
    }),
  );
  return app;
}

const remove = (
  userId: string | undefined,
  rid = RESERVATION,
  role: "user" | "admin" = "user",
) => request(appAs(userId, role)).delete(`/api/reservations/${rid}`);

beforeEach(() => {
  store = memoryReservationStore({ reservations: [booking()] });
});

describe("DELETE /api/reservations/:id (US 6)", () => {
  it("lets the owner delete their reservation permanently", async () => {
    const response = await remove(OWNER);
    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(await store.findById(RESERVATION)).toBeNull();
    expect(await store.listByUser(OWNER)).toEqual([]);
    expect((await remove(OWNER)).status).toBe(404);
  });

  it("lets an administrator delete another user's reservation", async () => {
    expect((await remove(ADMIN, RESERVATION, "admin")).status).toBe(204);
    expect(await store.findById(RESERVATION)).toBeNull();
  });

  it("forbids another employee without changing the reservation", async () => {
    const result = await remove(OTHER);
    expect(result.status).toBe(403);
    expect(result.body).toEqual({
      error: "You can only delete your own reservation",
    });
    expect(await store.findById(RESERVATION)).toEqual(booking());
  });

  it("rejects anonymous callers, bad ids and absent bookings", async () => {
    expect((await remove(undefined)).status).toBe(401);
    expect((await remove(OWNER, "invalid-id")).status).toBe(400);
    expect((await remove(OWNER, id(999))).status).toBe(404);
    expect(await store.findById(RESERVATION)).not.toBeNull();
  });

  it("immediately releases the deleted time window for another booking", async () => {
    const window = { start: START, end: END };
    const before = await store.findBusySpotIds(LOT, window, NOW);
    expect(before.has(SPOT)).toBe(true);

    expect((await remove(OWNER)).status).toBe(204);
    const after = await store.findBusySpotIds(LOT, window, NOW);
    expect(after.has(SPOT)).toBe(false);

    const newBooking = await store.createIfFree(
      {
        userId: OTHER,
        vehicleId: id(8),
        spotId: SPOT,
        lotId: LOT,
        startTime: START,
        endTime: END,
      },
      NOW,
    );
    expect(newBooking?.status).toBe("reserved");
  });

  it("keeps a spot blocked by a separate overlapping reservation", async () => {
    store = memoryReservationStore({
      reservations: [
        booking(),
        {
          ...booking(),
          id: id(8),
          userId: OTHER,
          vehicleId: id(9),
          startTime: new Date("2026-11-10T10:00:00.000Z"),
          endTime: new Date("2026-11-10T12:00:00.000Z"),
        },
      ],
    });
    expect((await remove(OWNER)).status).toBe(204);
    expect(
      (await store.findBusySpotIds(LOT, { start: START, end: END }, NOW)).has(
        SPOT,
      ),
    ).toBe(true);
  });

  it("refuses deletion while parking is active and preserves its session", async () => {
    store = memoryReservationStore({
      reservations: [booking("active")],
      sessions: [
        {
          id: id(10),
          reservationId: RESERVATION,
          spotId: SPOT,
          vehicleId: VEHICLE,
          entryTime: new Date("2026-11-10T09:00:00.000Z"),
          exitTime: null,
        },
      ],
    });
    const result = await remove(OWNER);
    expect(result.status).toBe(409);
    expect(await store.findById(RESERVATION)).toEqual(booking("active"));
  });

  it("refuses deletion if an open session exists before the status switches", async () => {
    store = memoryReservationStore({
      reservations: [booking()],
      sessions: [
        {
          id: id(10),
          reservationId: RESERVATION,
          spotId: SPOT,
          vehicleId: VEHICLE,
          entryTime: NOW,
          exitTime: null,
        },
      ],
    });
    expect((await remove(OWNER)).status).toBe(409);
    expect(await store.findById(RESERVATION)).not.toBeNull();
  });

  it("can delete a completed reservation", async () => {
    store = memoryReservationStore({
      reservations: [booking("completed")],
      sessions: [
        {
          id: id(10),
          reservationId: RESERVATION,
          spotId: SPOT,
          vehicleId: VEHICLE,
          entryTime: START,
          exitTime: END,
        },
      ],
    });
    expect((await remove(OWNER)).status).toBe(204);
    expect(await store.findById(RESERVATION)).toBeNull();
  });

  it("detects a concurrent edit and does not delete the newer reservation", async () => {
    const stale = booking();
    const update = await store.updateIfFree(
      stale,
      {
        vehicleId: VEHICLE,
        spotId: SPOT,
        lotId: LOT,
        startTime: START,
        endTime: new Date("2026-11-10T12:00:00.000Z"),
      },
      NOW,
    );
    expect(update.ok).toBe(true);
    expect(await store.deleteIfUnchanged(stale)).toBe("changed");
    expect((await store.findById(RESERVATION))?.endTime.toISOString()).toBe(
      "2026-11-10T12:00:00.000Z",
    );
  });
});
