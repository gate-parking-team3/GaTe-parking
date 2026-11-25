import type { AuditLogStore } from "../audit/audit.types.js";
import type {
  ParkingSpotRecord,
  ParkingSpotType,
} from "../parks/parkingSpot.types.js";
import type { ParkingLotRecord } from "../reservations/reservation.store.js";
import { withLotLock } from "./lot-lock.js";
import { DuplicateSpotNumberError } from "./spot.errors.js";
import type {
  AdminSpotStore,
  NewParkingSpot,
  ParkingLotLookup,
  SpotCounts,
} from "./spot.store.js";

type CapacityLimit = "total" | "ev" | "disabled" | "standard";

const CAPACITY_ERRORS: Record<CapacityLimit, string> = {
  total: "Parking lot is at total capacity",
  ev: "EV spot capacity exceeded",
  disabled: "Disabled spot capacity exceeded",
  standard: "Standard spot capacity exceeded",
};

export type CreateSpotSuccess = { ok: true; spot: ParkingSpotRecord };
export type CreateSpotFailure = {
  ok: false;
  status: 404 | 409;
  error: string;
};

export type SpotWriter = {
  spots: AdminSpotStore;
  auditLogs: AuditLogStore;
  lots: ParkingLotLookup;
  now: () => Date;
};

/**
 * Creates the spot and its audit row without a MongoDB transaction.
 * This backend never starts a transaction, and the local database cannot run one.
 * The spot is removed again when it would exceed capacity or when the audit row
 * cannot be saved, so a failed request does not keep either write.
 */
export async function createSpotWithAudit(
  writer: SpotWriter,
  input: NewParkingSpot,
  userId: string,
): Promise<CreateSpotSuccess | CreateSpotFailure> {
  const lot = await writer.lots.findById(input.lotId);
  if (!lot) return { ok: false, status: 404, error: "Parking lot not found" };

  return withLotLock(input.lotId, () => writeSpot(writer, input, userId, lot));
}

async function writeSpot(
  writer: SpotWriter,
  input: NewParkingSpot,
  userId: string,
  lot: ParkingLotRecord,
): Promise<CreateSpotSuccess | CreateSpotFailure> {
  let created: ParkingSpotRecord | null = null;
  try {
    created = await writer.spots.insert(input);
    const limit = capacityLimit(
      input.type,
      await writer.spots.count(input.lotId),
      lot,
    );
    if (limit) {
      await writer.spots.deleteById(created.id);
      return { ok: false, status: 409, error: CAPACITY_ERRORS[limit] };
    }
    await writer.auditLogs.append({
      userId,
      actionType: "spot.created",
      action: `Created parking spot ${created.spotNumber} in lot ${lot.name}`,
      createdAt: writer.now(),
    });
    return { ok: true, spot: created };
  } catch (error) {
    if (error instanceof DuplicateSpotNumberError) {
      return {
        ok: false,
        status: 409,
        error: "Spot number already exists in this parking lot",
      };
    }
    if (created) {
      await writer.spots
        .deleteById(created.id)
        .catch((deleteError: unknown) => {
          console.error(
            "Could not remove a parking spot after a failed create",
            deleteError,
          );
        });
    }
    throw error;
  }
}

// Counts every spot, whatever its status. Total is checked first: a full lot
// reports total capacity. A type limit is reported only while other types
// still have unused room (standard room is total - ev - disabled).
export function capacityLimit(
  type: ParkingSpotType,
  counts: SpotCounts,
  lot: Pick<
    ParkingLotRecord,
    "totalCapacity" | "evCapacity" | "disabledCapacity"
  >,
): CapacityLimit | null {
  if (counts.total > lot.totalCapacity) return "total";
  if (type === "ev" && counts.ev > lot.evCapacity) return "ev";
  if (type === "disabled" && counts.disabled > lot.disabledCapacity) {
    return "disabled";
  }
  const standardRoom =
    lot.totalCapacity - lot.evCapacity - lot.disabledCapacity;
  if (type === "standard" && counts.standard > standardRoom) return "standard";
  return null;
}
