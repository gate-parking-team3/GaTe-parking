import type { ParkingSpotRecord } from "../parks/parkingSpot.types.js";
import type { ReservationRecord } from "../parks/reservation.types.js";
import { BLOCKING_STATUSES, windowsOverlap } from "./reservation.rules.js";
import type {
  ParkingLotRecord,
  ReservationStore,
} from "./reservation.store.js";

type Seed = {
  lots?: ParkingLotRecord[];
  spots?: ParkingSpotRecord[];
  reservations?: ReservationRecord[];
};

// In-memory ReservationStore for tests. Ids are 24 hex characters like MongoDB ids.
export function memoryReservationStore(seed: Seed = {}): ReservationStore {
  const lots = [...(seed.lots ?? [])];
  const spots = [...(seed.spots ?? [])];
  const reservations = (seed.reservations ?? []).map((r) => ({ ...r }));
  let nextId = 1;

  const blocking = (r: ReservationRecord) =>
    BLOCKING_STATUSES.includes(r.status);

  return {
    async listLots() {
      return [...lots];
    },
    async findLot(id) {
      return lots.find((lot) => lot.id === id) ?? null;
    },
    async listSpots(lotId) {
      return spots.filter((spot) => spot.lotId === lotId);
    },
    async findSpot(id) {
      return spots.find((spot) => spot.id === id) ?? null;
    },
    async findBusySpotIds(lotId, window) {
      return new Set(
        reservations
          .filter(
            (r) =>
              r.lotId === lotId &&
              blocking(r) &&
              windowsOverlap(window, { start: r.startTime, end: r.endTime }),
          )
          .map((r) => r.spotId),
      );
    },
    async createIfFree(input) {
      const window = { start: input.startTime, end: input.endTime };
      const taken = reservations.some(
        (r) =>
          blocking(r) &&
          (r.spotId === input.spotId || r.vehicleId === input.vehicleId) &&
          windowsOverlap(window, { start: r.startTime, end: r.endTime }),
      );
      if (taken) return null;
      const id = (nextId++).toString(16).padStart(24, "e");
      const created: ReservationRecord = { id, ...input, status: "reserved" };
      reservations.push(created);
      return { ...created };
    },
    async listByUser(userId) {
      return reservations
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    },
    async findById(id) {
      return reservations.find((r) => r.id === id) ?? null;
    },
  };
}
