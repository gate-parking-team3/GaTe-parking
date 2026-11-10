import type { ParkingSpotRecord } from "../parks/parkingSpot.types.js";
import type { ReservationRecord } from "../parks/reservation.types.js";
import { BLOCKING_STATUSES, windowsOverlap } from "./reservation.rules.js";
import type {
  ParkingLotRecord,
  ParkingSessionRecord,
  ReservationStore,
} from "./reservation.store.js";

type Seed = {
  lots?: ParkingLotRecord[];
  spots?: ParkingSpotRecord[];
  reservations?: ReservationRecord[];
  sessions?: ParkingSessionRecord[];
};

// In-memory ReservationStore for tests. Ids are 24 hex characters like MongoDB ids.
export function memoryReservationStore(seed: Seed = {}): ReservationStore {
  const lots = [...(seed.lots ?? [])];
  const spots = [...(seed.spots ?? [])];
  const reservations = (seed.reservations ?? []).map((r) => ({ ...r }));
  const sessions = (seed.sessions ?? []).map((s) => ({ ...s }));
  let nextId = 1;
  const newId = () => (nextId++).toString(16).padStart(24, "e");

  const blocking = (r: ReservationRecord) =>
    BLOCKING_STATUSES.includes(r.status);
  // Same rule as the MongoDB store: an open session blocks its spot from entry on.
  const sessionWindow = (s: ParkingSessionRecord) => ({
    start: s.entryTime,
    end: s.exitTime ?? new Date(8.64e15),
  });

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
      const lotSpotIds = new Set(
        spots.filter((s) => s.lotId === lotId).map((s) => s.id),
      );
      return new Set([
        ...reservations
          .filter(
            (r) =>
              r.lotId === lotId &&
              blocking(r) &&
              windowsOverlap(window, { start: r.startTime, end: r.endTime }),
          )
          .map((r) => r.spotId),
        ...sessions
          .filter(
            (s) =>
              lotSpotIds.has(s.spotId) &&
              windowsOverlap(window, sessionWindow(s)),
          )
          .map((s) => s.spotId),
      ]);
    },
    async createIfFree(input) {
      const window = { start: input.startTime, end: input.endTime };
      const taken = reservations.some(
        (r) =>
          blocking(r) &&
          (r.spotId === input.spotId || r.vehicleId === input.vehicleId) &&
          windowsOverlap(window, { start: r.startTime, end: r.endTime }),
      );
      const parked = sessions.some(
        (s) =>
          s.spotId === input.spotId && windowsOverlap(window, sessionWindow(s)),
      );
      if (taken || parked) return null;
      const id = newId();
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
    async startParking(id, entryTime) {
      const reservation = reservations.find((r) => r.id === id);
      if (!reservation || reservation.status !== "reserved") {
        return { ok: false, conflict: "wrong-status" };
      }
      const parked = sessions.some(
        (s) =>
          s.exitTime === null &&
          (s.spotId === reservation.spotId ||
            s.vehicleId === reservation.vehicleId),
      );
      if (parked) return { ok: false, conflict: "already-parked" };
      reservation.status = "active";
      const session: ParkingSessionRecord = {
        id: newId(),
        spotId: reservation.spotId,
        vehicleId: reservation.vehicleId,
        reservationId: reservation.id,
        entryTime,
        exitTime: null,
      };
      sessions.push(session);
      return {
        ok: true,
        value: { reservation: { ...reservation }, session: { ...session } },
      };
    },
    async endParking(id, exitTime) {
      const reservation = reservations.find((r) => r.id === id);
      const session = sessions.find(
        (s) => s.reservationId === id && s.exitTime === null,
      );
      if (!reservation || reservation.status !== "active" || !session) {
        return { ok: false, conflict: "wrong-status" };
      }
      reservation.status = "completed";
      session.exitTime = exitTime;
      return {
        ok: true,
        value: { reservation: { ...reservation }, session: { ...session } },
      };
    },
  };
}
