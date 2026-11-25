import {
  PARKING_SPOT_SIZES,
  PARKING_SPOT_STATUSES,
  PARKING_SPOT_TYPES,
  type ParkingSpotStatus,
} from "../parks/parkingSpot.types.js";
import type { NewParkingSpot } from "./spot.store.js";

const SPOT_NUMBER = /^[A-Z0-9-]+$/;

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseCreateSpot(body: unknown): ParseResult<NewParkingSpot> {
  if (!isRecord(body)) return fail("Request body must be an object");

  const spotNumber = readSpotNumber(body.spotNumber);
  if (!spotNumber.ok) return spotNumber;

  const lotId = readRequiredText(body.lotId, "lotId");
  if (!lotId.ok) return lotId;

  const type = readEnum(body.type, "type", PARKING_SPOT_TYPES);
  if (!type.ok) return type;

  const size = readEnum(body.size, "size", PARKING_SPOT_SIZES);
  if (!size.ok) return size;

  const status = readStatus(body);
  if (!status.ok) return status;

  return {
    ok: true,
    value: {
      spotNumber: spotNumber.value,
      lotId: lotId.value,
      type: type.value,
      size: size.value,
      status: status.value,
    },
  };
}

export function parseLotQuery(query: unknown): ParseResult<{ lotId?: string }> {
  const lotId = readQueryValue(query, "lotId");
  if (!lotId.ok) return lotId;
  if (lotId.value === undefined) return { ok: true, value: {} };
  const trimmed = lotId.value.trim();
  if (trimmed.length === 0) return fail("lotId must be a non-empty string");
  return { ok: true, value: { lotId: trimmed } };
}

function readSpotNumber(value: unknown): ParseResult<string> {
  if (typeof value !== "string") return fail("spotNumber is required");
  const normalized = value.trim().toUpperCase();
  if (normalized.length === 0) return fail("spotNumber is required");
  if (!SPOT_NUMBER.test(normalized)) {
    return fail(
      "spotNumber may contain only letters A-Z, digits 0-9, and hyphens",
    );
  }
  return { ok: true, value: normalized };
}

function readStatus(
  body: Record<string, unknown>,
): ParseResult<ParkingSpotStatus> {
  if (!("status" in body) || body.status === undefined) {
    return { ok: true, value: "free" };
  }
  return readEnum(body.status, "status", PARKING_SPOT_STATUSES);
}

function readRequiredText(value: unknown, field: string): ParseResult<string> {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(`${field} is required`);
  }
  return { ok: true, value: value.trim() };
}

function readEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): ParseResult<T> {
  if (typeof value !== "string") {
    return fail(`${field} must be one of: ${allowed.join(", ")}`);
  }
  const normalized = value.trim() as T;
  if (!allowed.includes(normalized)) {
    return fail(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return { ok: true, value: normalized };
}

export function readQueryValue(
  query: unknown,
  field: string,
): ParseResult<string | undefined> {
  if (!isRecord(query) || !(field in query)) {
    return { ok: true, value: undefined };
  }
  const value = query[field];
  if (Array.isArray(value) || typeof value !== "string") {
    return fail(`${field} must be a single value`);
  }
  return { ok: true, value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(error: string): ParseResult<never> {
  return { ok: false, error };
}
