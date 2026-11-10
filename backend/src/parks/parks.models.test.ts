import { describe, expect, it } from "vitest";
import { ParkingLotModel } from "./parkingLot.model.js";
import { ParkingSessionModel } from "./parkingSession.model.js";
import { ParkingSpotModel } from "./parkingSpot.model.js";
import { ReservationModel } from "./reservation.model.js";

const lot = {
  name: "Main lot",
  address: "Street 1",
  totalCapacity: 10,
  evCapacity: 2,
  disabledCapacity: 1,
};

const reservation = {
  userId: "U001",
  vehicleId: "V001",
  spotId: "S001",
  lotId: "L001",
  startTime: new Date("2026-11-10T08:00:00Z"),
  endTime: new Date("2026-11-10T10:00:00Z"),
};

describe("ParkingLotModel", () => {
  it("accepts a valid lot", () => {
    expect(new ParkingLotModel(lot).validateSync()).toBeUndefined();
  });

  it("rejects EV + disabled capacity above the total", () => {
    const error = new ParkingLotModel({
      ...lot,
      evCapacity: 8,
      disabledCapacity: 8,
    }).validateSync();
    expect(error?.errors.totalCapacity).toBeDefined();
  });

  it("rejects negative capacity", () => {
    const error = new ParkingLotModel({
      ...lot,
      evCapacity: -1,
    }).validateSync();
    expect(error?.errors.evCapacity).toBeDefined();
  });
});

describe("ParkingSpotModel", () => {
  const spot = { spotNumber: "A1", lotId: "L001", type: "ev", size: "small" };

  it("defaults the status to free", () => {
    const doc = new ParkingSpotModel(spot);
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.status).toBe("free");
  });

  it("rejects unknown type, size and status", () => {
    const error = new ParkingSpotModel({
      ...spot,
      type: "vip",
      size: "huge",
      status: "broken",
    }).validateSync();
    expect(Object.keys(error?.errors ?? {}).sort()).toEqual([
      "size",
      "status",
      "type",
    ]);
  });

  it("has a unique spot number per lot", () => {
    expect(ParkingSpotModel.schema.indexes()).toContainEqual([
      { lotId: 1, spotNumber: 1 },
      expect.objectContaining({ unique: true }),
    ]);
  });
});

describe("ReservationModel", () => {
  it("accepts a valid reservation and defaults the status to reserved", () => {
    const doc = new ReservationModel(reservation);
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.status).toBe("reserved");
  });

  it("rejects an end time that is not after the start time", () => {
    const error = new ReservationModel({
      ...reservation,
      endTime: reservation.startTime,
    }).validateSync();
    expect(error?.errors.endTime).toBeDefined();
  });

  it("does not store a version key", () => {
    expect(ReservationModel.schema.get("versionKey")).toBe(false);
  });

  it("expires edit holds through a TTL index", () => {
    expect(ReservationModel.schema.indexes()).toContainEqual([
      { holdExpiresAt: 1 },
      expect.objectContaining({ expireAfterSeconds: 0 }),
    ]);
  });
});

describe("ParkingSessionModel", () => {
  const session = {
    spotId: "S001",
    vehicleId: "V001",
    entryTime: new Date("2026-11-10T08:00:00Z"),
  };

  it("starts as active with exitTime null", () => {
    const doc = new ParkingSessionModel(session);
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.exitTime).toBeNull();
  });

  it("rejects an exit time before the entry time", () => {
    const error = new ParkingSessionModel({
      ...session,
      exitTime: new Date("2026-11-10T07:00:00Z"),
    }).validateSync();
    expect(error?.errors.exitTime).toBeDefined();
  });

  it.each(["vehicleId", "spotId"])(
    "allows only one active session per %s",
    (field) => {
      expect(ParkingSessionModel.schema.indexes()).toContainEqual([
        { [field]: 1 },
        {
          unique: true,
          partialFilterExpression: { exitTime: { $type: "null" } },
        },
      ]);
    },
  );
});
