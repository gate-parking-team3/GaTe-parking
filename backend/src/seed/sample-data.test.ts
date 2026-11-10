import { describe, expect, it } from "vitest";
import {
  PARKING_SPOT_SIZES,
  PARKING_SPOT_TYPES,
} from "../parks/parkingSpot.types.js";
import { normalizeEmail, ROLES, USER_STATUSES } from "../users/user.js";
import {
  VEHICLE_ENGINE_TYPES,
  VEHICLE_SIZES,
} from "../vehicles/vehicle.types.js";
import { validateLicensePlate } from "../vehicles/vehicle.validation.js";
import {
  SAMPLE_LOTS,
  SAMPLE_PASSWORD,
  SAMPLE_USERS,
  SAMPLE_VEHICLES,
} from "./sample-data.js";

describe("sample data", () => {
  it("has valid, unique users including an active admin", () => {
    const emails = SAMPLE_USERS.map((u) => u.email);
    expect(new Set(emails).size).toBe(emails.length);
    for (const user of SAMPLE_USERS) {
      expect(user.email).toBe(normalizeEmail(user.email));
      expect(ROLES).toContain(user.role);
      expect(USER_STATUSES).toContain(user.status);
    }
    expect(
      SAMPLE_USERS.some((u) => u.role === "admin" && u.status === "active"),
    ).toBe(true);
    expect(SAMPLE_PASSWORD.length).toBeGreaterThanOrEqual(8);
  });

  it("has vehicles that pass the vehicle rules and belong to sample users", () => {
    const keys = new Set(SAMPLE_USERS.map((u) => u.key));
    const plates = SAMPLE_VEHICLES.map((v) => v.licensePlate);
    expect(new Set(plates).size).toBe(plates.length);
    for (const vehicle of SAMPLE_VEHICLES) {
      expect(validateLicensePlate(vehicle.licensePlate)).toEqual({
        valid: true,
        normalized: vehicle.licensePlate,
      });
      expect(VEHICLE_ENGINE_TYPES).toContain(vehicle.engineType);
      expect(VEHICLE_SIZES).toContain(vehicle.size);
      expect(keys).toContain(vehicle.owner);
    }
  });

  it("has lots with unique names and valid spots numbered uniquely per lot", () => {
    const names = SAMPLE_LOTS.map((lot) => lot.name);
    expect(new Set(names).size).toBe(names.length);
    for (const lot of SAMPLE_LOTS) {
      const numbers = lot.spots.map((s) => s.spotNumber);
      expect(new Set(numbers).size).toBe(numbers.length);
      for (const spot of lot.spots) {
        expect(PARKING_SPOT_TYPES).toContain(spot.type);
        expect(PARKING_SPOT_SIZES).toContain(spot.size);
      }
    }
  });

  it("has a spot for every sample vehicle's engine type and size", () => {
    const all = SAMPLE_LOTS.flatMap((lot) => lot.spots);
    for (const type of PARKING_SPOT_TYPES) {
      expect(all.some((s) => s.type === type)).toBe(true);
    }
    for (const size of PARKING_SPOT_SIZES) {
      expect(all.some((s) => s.type === "standard" && s.size === size)).toBe(
        true,
      );
    }
  });
});
