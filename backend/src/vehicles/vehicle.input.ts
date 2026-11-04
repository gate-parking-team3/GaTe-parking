import { validateLicensePlate } from "./vehicle.validation.js";
import {
  VEHICLE_ENGINE_TYPES,
  VEHICLE_SIZES,
  type VehicleEngineType,
  type VehicleFields,
  type VehicleSize,
} from "./vehicle.types.js";

export type VehicleUpdate = Partial<VehicleFields>;

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseCreateVehicle(body: unknown): ParseResult<VehicleFields> {
  if (!isRecord(body)) {
    return fail("Request body must be an object");
  }

  const licensePlate = readPlate(body.licensePlate);
  if (!licensePlate.ok) return licensePlate;

  const brand = readText(body.brand, "Brand");
  if (!brand.ok) return brand;

  const model = readText(body.model, "Model");
  if (!model.ok) return model;

  const engineType = readEngineType(body.engineType);
  if (!engineType.ok) return engineType;

  const size = readSize(body.size);
  if (!size.ok) return size;

  return {
    ok: true,
    value: {
      licensePlate: licensePlate.value,
      brand: brand.value,
      model: model.value,
      engineType: engineType.value,
      size: size.value,
    },
  };
}

export function parseUpdateVehicle(body: unknown): ParseResult<VehicleUpdate> {
  if (!isRecord(body)) {
    return fail("Request body must be an object");
  }

  if ("userId" in body) return fail("userId cannot be changed");
  if ("id" in body || "_id" in body) {
    return fail("Vehicle id cannot be changed");
  }

  const value: VehicleUpdate = {};

  if ("licensePlate" in body) {
    const licensePlate = readPlate(body.licensePlate);
    if (!licensePlate.ok) return licensePlate;
    value.licensePlate = licensePlate.value;
  }

  if ("brand" in body) {
    const brand = readText(body.brand, "Brand");
    if (!brand.ok) return brand;
    value.brand = brand.value;
  }

  if ("model" in body) {
    const model = readText(body.model, "Model");
    if (!model.ok) return model;
    value.model = model.value;
  }

  if ("engineType" in body) {
    const engineType = readEngineType(body.engineType);
    if (!engineType.ok) return engineType;
    value.engineType = engineType.value;
  }

  if ("size" in body) {
    const size = readSize(body.size);
    if (!size.ok) return size;
    value.size = size.value;
  }

  if (Object.keys(value).length === 0) {
    return fail("No vehicle fields to update");
  }

  return { ok: true, value };
}

function readPlate(value: unknown): ParseResult<string> {
  if (typeof value !== "string") return fail("License plate is required");

  const result = validateLicensePlate(value);
  if (!result.valid) return fail(result.reason);

  return { ok: true, value: result.normalized };
}

function readText(value: unknown, label: string): ParseResult<string> {
  if (typeof value !== "string" || value.trim() === "") {
    return fail(`${label} is required`);
  }

  return { ok: true, value: value.trim() };
}

function readEngineType(value: unknown): ParseResult<VehicleEngineType> {
  return readChoice(value, "Engine type", VEHICLE_ENGINE_TYPES);
}

function readSize(value: unknown): ParseResult<VehicleSize> {
  return readChoice(value, "Size", VEHICLE_SIZES);
}

function readChoice<T extends string>(
  value: unknown,
  label: string,
  allowed: readonly T[],
): ParseResult<T> {
  if (typeof value !== "string") return fail(`${label} is required`);

  const normalized = value.trim();
  if (!(allowed as readonly string[]).includes(normalized)) {
    return fail(`${label} must be one of: ${allowed.join(", ")}`);
  }

  return { ok: true, value: normalized as T };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
