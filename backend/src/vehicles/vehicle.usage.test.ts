import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryUserStore } from "../users/memory-user-store.js";
import type { User } from "../users/user.js";

const reservationExists = vi.fn();
const sessionExists = vi.fn();
const findOne = vi.fn();
const deleteOne = vi.fn();

vi.mock("../parks/reservation.model.js", () => ({
  ReservationModel: { exists: (...a: unknown[]) => reservationExists(...a) },
}));
vi.mock("../parks/parkingSession.model.js", () => ({
  ParkingSessionModel: { exists: (...a: unknown[]) => sessionExists(...a) },
}));
vi.mock("./vehicle.model.js", () => ({
  VehicleModel: {
    findOne: (...a: unknown[]) => findOne(...a),
    deleteOne: (...a: unknown[]) => deleteOne(...a),
  },
}));
vi.mock("../users/user.model.js", () => ({ mongoUserStore: {} }));

const { mongoVehicleUsage } = await import("./vehicle.usage.js");

const now = new Date("2026-11-10T08:00:00Z");
const user = (id: string, status: User["status"]): User => ({
  id,
  email: `${id}@example.com`,
  name: id,
  passwordHash: "x",
  role: "user",
  status,
});
const usage = mongoVehicleUsage(
  memoryUserStore([user("ACTIVE", "active"), user("GONE", "disabled")]),
);
const holder = (userId: string) => ({
  lean: () => Promise.resolve({ _id: "V1", userId }),
});

beforeEach(() => {
  for (const fn of [reservationExists, sessionExists, findOne, deleteOne]) {
    fn.mockReset();
  }
  reservationExists.mockResolvedValue(null);
  sessionExists.mockResolvedValue(null);
});

describe("mongoVehicleUsage.isInUse", () => {
  it("is false without reservations or an open session", async () => {
    expect(await usage.isInUse("V1", now)).toBe(false);
  });

  it("counts active and not yet ended reserved reservations", async () => {
    reservationExists.mockResolvedValue({ _id: "R1" });
    expect(await usage.isInUse("V1", now)).toBe(true);
    expect(reservationExists).toHaveBeenCalledWith({
      vehicleId: "V1",
      $or: [
        { status: "active" },
        { status: "reserved", endTime: { $gt: now } },
      ],
    });
  });

  it("counts an open parking session", async () => {
    sessionExists.mockResolvedValue({ _id: "S1" });
    expect(await usage.isInUse("V1", now)).toBe(true);
  });
});

describe("mongoVehicleUsage.releasePlate", () => {
  it("keeps a plate that belongs to an active user", async () => {
    findOne.mockReturnValue(holder("ACTIVE"));
    expect(await usage.releasePlate("1AB2345", now)).toBe(false);
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it("removes an inactive user's unused vehicle", async () => {
    findOne.mockReturnValue(holder("GONE"));
    expect(await usage.releasePlate("1AB2345", now)).toBe(true);
    expect(deleteOne).toHaveBeenCalledWith({ _id: "V1", userId: "GONE" });
  });

  it("keeps an inactive user's vehicle that is still in use", async () => {
    findOne.mockReturnValue(holder("GONE"));
    sessionExists.mockResolvedValue({ _id: "S1" });
    expect(await usage.releasePlate("1AB2345", now)).toBe(false);
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it("reports a plate as free when nobody holds it any more", async () => {
    findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    expect(await usage.releasePlate("1AB2345", now)).toBe(true);
  });
});
