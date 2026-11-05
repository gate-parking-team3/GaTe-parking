import { describe, expect, it } from "vitest";
import { normalizeEmail, ROLES, USER_STATUSES } from "../users/user.js";
import {
  VEHICLE_ENGINE_TYPES,
  VEHICLE_SIZES,
} from "../vehicles/vehicle.types.js";
import { validateLicensePlate } from "../vehicles/vehicle.validation.js";
import {
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
});
