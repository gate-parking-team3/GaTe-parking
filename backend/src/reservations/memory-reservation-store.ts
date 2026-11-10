import type { ParkingSpotRecord } from "../parks/parkingSpot.types.js";
import type { ReservationRecord } from "../parks/reservation.types.js";
import {
  BLOCKING_STATUSES,
  windowsOverlap,
  type TimeWindow,
} from "./reservation.rules.js";
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
  // Same rule as the MongoDB store (sessionOverlapping): an open session blocks its spot
  // for windows that start by now.
  const sessionBlocks = (
    s: ParkingSessionRecord,
    window: TimeWindow,
    now: Date,
  ) =>
    s.entryTime < window.end &&
    (s.exitTime ? s.exitTime > window.start : window.start <= now);
  const openSessionOf = (r: ReservationRecord) =>
    sessions.find((s) => s.reservationId === r.id && s.exitTime === null);

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
    async findBusySpotIds(lotId, window, now) {
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
            (s) => lotSpotIds.has(s.spotId) && sessionBlocks(s, window, now),
          )
          .map((s) => s.spotId),
      ]);
    },
    async createIfFree(input, now) {
      const window = { start: input.startTime, end: input.endTime };
      const taken = reservations.some(
        (r) =>
          blocking(r) &&
          (r.spotId === input.spotId || r.vehicleId === input.vehicleId) &&
          windowsOverlap(window, { start: r.startTime, end: r.endTime }),
      );
      const parked = sessions.some(
        (s) => s.spotId === input.spotId && sessionBlocks(s, window, now),
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
      // Like the MongoDB store: reuse a session left by an attempt that stopped halfway,
      // otherwise refuse a second open session on the spot or the vehicle.
      let session = openSessionOf(reservation);
      if (!session) {
        const parked = sessions.some(
          (s) =>
            s.exitTime === null &&
            (s.spotId === reservation.spotId ||
              s.vehicleId === reservation.vehicleId),
        );
        if (parked) return { ok: false, conflict: "already-parked" };
        session = {
          id: newId(),
          spotId: reservation.spotId,
          vehicleId: reservation.vehicleId,
          reservationId: reservation.id,
          entryTime,
          exitTime: null,
        };
        sessions.push(session);
      }
      reservation.status = "active";
      return {
        ok: true,
        value: { reservation: { ...reservation }, session: { ...session } },
      };
    },
    async endParking(id, exitTime) {
      const reservation = reservations.find((r) => r.id === id);
      if (!reservation || reservation.status !== "active") {
        return { ok: false, conflict: "wrong-status" };
      }
      const open = openSessionOf(reservation);
      if (open) open.exitTime = exitTime;
      reservation.status = "completed";
      const session = sessions
        .filter((s) => s.reservationId === id)
        .sort((a, b) => b.entryTime.getTime() - a.entryTime.getTime())[0];
      if (!session) {
        throw new Error(
          `Reservation ${id} was active without a parking session`,
        );
      }
      return {
        ok: true,
        value: { reservation: { ...reservation }, session: { ...session } },
      };
    },
  };
}
