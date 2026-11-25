import type { ParkingSpotRecord } from "../parks/parkingSpot.types.js";
import { DuplicateSpotNumberError } from "./spot.errors.js";
import type {
  AdminSpotStore,
  NewParkingSpot,
  SpotCounts,
} from "./spot.store.js";

// In-memory spots for tests. The unique (lot, number) rule matches the MongoDB index.
export function memoryAdminSpotStore(
  initial: ParkingSpotRecord[] = [],
): AdminSpotStore {
  const spots = initial.map((spot) => ({ ...spot }));
  let sequence = spots.length + 1;

  return {
    async list(lotId) {
      return spots
        .filter((spot) => lotId === undefined || spot.lotId === lotId)
        .sort(
          (a, b) =>
            a.spotNumber.localeCompare(b.spotNumber) ||
            a.lotId.localeCompare(b.lotId),
        )
        .map((spot) => ({ ...spot }));
    },

    async insert(input: NewParkingSpot) {
      const taken = spots.some(
        (spot) =>
          spot.lotId === input.lotId && spot.spotNumber === input.spotNumber,
      );
      if (taken) throw new DuplicateSpotNumberError();
      const record: ParkingSpotRecord = {
        ...input,
        id: sequence.toString(16).padStart(24, "0"),
      };
      sequence += 1;
      spots.push(record);
      return { ...record };
    },

    async count(lotId) {
      const counts: SpotCounts = {
        total: 0,
        standard: 0,
        ev: 0,
        disabled: 0,
      };
      for (const spot of spots) {
        if (spot.lotId !== lotId) continue;
        counts.total += 1;
        counts[spot.type] += 1;
      }
      return counts;
    },

    async deleteById(id) {
      const index = spots.findIndex((spot) => spot.id === id);
      if (index >= 0) spots.splice(index, 1);
    },
  };
}
