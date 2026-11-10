// US 4 rules that do not need the database: which spot suits which vehicle,
// what a valid time window is, and which reservations block a spot.
import type { ParkingSpotRecord } from "../parks/parkingSpot.types.js";
import type { ReservationStatus } from "../parks/reservation.types.js";
import type { VehicleRecord, VehicleSize } from "../vehicles/vehicle.types.js";

/** Reservations in these statuses hold their spot (and vehicle) for their time window. */
export const BLOCKING_STATUSES: readonly ReservationStatus[] = [
  "reserved",
  "active",
];

/** Allowed lateness for a start time, so a form opened a moment ago still works. */
export const START_GRACE_MS = 5 * 60 * 1000;

export type TimeWindow = { start: Date; end: Date };

export type SpotFilter = {
  /** Disabled spots are offered only to entitled users. Users have no such flag yet, so callers pass false. */
  disabledAllowed: boolean;
  /** US 4 "EV-only" filter for electric cars. */
  evOnly?: boolean;
};

const SIZE_RANK: Record<VehicleSize, number> = {
  small: 0,
  standard: 1,
  large: 2,
};

/**
 * US 4 suitability rules:
 * - a vehicle fits a spot of its own size or larger;
 * - EV spots only for electric cars, disabled spots only when entitled;
 * - combustion cars get standard spots, electric cars EV and standard spots.
 */
export function spotSuitsVehicle(
  spot: Pick<ParkingSpotRecord, "type" | "size">,
  vehicle: Pick<VehicleRecord, "engineType" | "size">,
  filter: SpotFilter,
): boolean {
  if (SIZE_RANK[spot.size] < SIZE_RANK[vehicle.size]) return false;
  if (filter.evOnly && spot.type !== "ev") return false;
  if (spot.type === "ev") return vehicle.engineType === "electric";
  if (spot.type === "disabled") return filter.disabledAllowed;
  return true;
}

/** Two windows overlap when each starts before the other ends (touching ends do not overlap). */
export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.start < b.end && b.start < a.end;
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Reads an ISO start/end pair. The end must be after the start and the start not in the past. */
export function parseTimeWindow(
  start: unknown,
  end: unknown,
  now: Date,
): ParseResult<TimeWindow> {
  const startDate = readDate(start);
  const endDate = readDate(end);
  if (!startDate || !endDate) {
    return { ok: false, error: "Start and end must be ISO date-times" };
  }
  if (endDate <= startDate) {
    return { ok: false, error: "End must be after start" };
  }
  if (startDate.getTime() < now.getTime() - START_GRACE_MS) {
    return { ok: false, error: "Start cannot be in the past" };
  }
  return { ok: true, value: { start: startDate, end: endDate } };
}

function readDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
