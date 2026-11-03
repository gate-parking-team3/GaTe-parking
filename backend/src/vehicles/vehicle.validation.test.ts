import { describe, expect, it } from "vitest";
import {
  hasEvFlag,
  isLicensePlateUnique,
  normalizeLicensePlate,
  validateLicensePlate,
} from "./vehicle.validation.js";

describe("normalizeLicensePlate", () => {
  it("converts lowercase letters to uppercase", () => {
    expect(normalizeLicensePlate("1ab2345")).toBe("1AB2345");
  });

  it("removes spaces and hyphens", () => {
    expect(normalizeLicensePlate("1AB 2345")).toBe("1AB2345");
    expect(normalizeLicensePlate("1ab-2345")).toBe("1AB2345");
    expect(normalizeLicensePlate("1 ab - 2345")).toBe("1AB2345");
  });
});

describe("validateLicensePlate", () => {
  it("accepts a normalized plate of letters and digits", () => {
    expect(validateLicensePlate("1AB2345")).toEqual({
      valid: true,
      normalized: "1AB2345",
    });
  });

  it("accepts a plate that contains only digits", () => {
    expect(validateLicensePlate("1234567")).toEqual({
      valid: true,
      normalized: "1234567",
    });
  });

  it("accepts a plate after lowercase, space and hyphen normalization", () => {
    expect(validateLicensePlate("1ab- 2345")).toEqual({
      valid: true,
      normalized: "1AB2345",
    });
  });

  it("rejects an empty plate", () => {
    expect(validateLicensePlate("")).toEqual({
      valid: false,
      normalized: "",
      reason: "License plate must not be empty",
    });
    expect(validateLicensePlate(" - ")).toEqual({
      valid: false,
      normalized: "",
      reason: "License plate must not be empty",
    });
  });

  it("rejects a plate shorter than 2 characters", () => {
    expect(validateLicensePlate("A")).toEqual({
      valid: false,
      normalized: "A",
      reason: "License plate must contain at least 2 characters",
    });
  });

  it("rejects a plate longer than 12 characters", () => {
    expect(validateLicensePlate("ABC1234567890")).toEqual({
      valid: false,
      normalized: "ABC1234567890",
      reason: "License plate must contain at most 12 characters",
    });
  });

  it("rejects invalid characters", () => {
    expect(validateLicensePlate("AB@12")).toEqual({
      valid: false,
      normalized: "AB@12",
      reason: "License plate may contain only letters A-Z and digits 0-9",
    });
    expect(validateLicensePlate("1AB 23.45")).toMatchObject({ valid: false });
  });

  it("accepts the shortest and longest allowed plates", () => {
    expect(validateLicensePlate("A1").valid).toBe(true);
    expect(validateLicensePlate("ABC123456789").valid).toBe(true);
  });
});

describe("isLicensePlateUnique", () => {
  it("detects a duplicate when only the formatting differs", () => {
    expect(isLicensePlateUnique("1ab-2345", ["1AB 2345"])).toBe(false);
  });

  it("distinguishes two different normalized plates", () => {
    expect(isLicensePlateUnique("1AB2345", ["1AB2346"])).toBe(true);
  });

  it("accepts a plate that does not match any existing normalized plate", () => {
    expect(isLicensePlateUnique("2CD3456", ["1AB 2345", "3EF-6789"])).toBe(
      true,
    );
  });

  it("accepts a plate when nothing is stored yet", () => {
    expect(isLicensePlateUnique("1AB2345", [])).toBe(true);
  });
});

describe("hasEvFlag", () => {
  it("returns true only for ev", () => {
    expect(hasEvFlag("ev")).toBe(true);
    expect(hasEvFlag("combustion")).toBe(false);
    expect(hasEvFlag("hybrid")).toBe(false);
  });

  it("rejects an unsupported engine type", () => {
    expect(() => hasEvFlag("diesel")).toThrow(
      "Unsupported engine type: diesel",
    );
    expect(() => hasEvFlag("electric")).toThrow(/Unsupported engine type/);
  });
});
