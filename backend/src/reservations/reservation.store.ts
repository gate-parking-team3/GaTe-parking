import mongoose from "mongoose";
import { ParkingLotModel } from "../parks/parkingLot.model.js";
import { ParkingSessionModel } from "../parks/parkingSession.model.js";
import { ParkingSpotModel } from "../parks/parkingSpot.model.js";
import type { ParkingSpotRecord } from "../parks/parkingSpot.types.js";
import { ReservationModel } from "../parks/reservation.model.js";
import type { ReservationRecord } from "../parks/reservation.types.js";
import { BLOCKING_STATUSES, type TimeWindow } from "./reservation.rules.js";

export type ParkingLotRecord = {
  id: string;
  name: string;
  address: string;
  totalCapacity: number;
  evCapacity: number;
  disabledCapacity: number;
};

export type NewReservation = Omit<ReservationRecord, "id" | "status">;

export type ParkingSessionRecord = {
  id: string;
  spotId: string;
  vehicleId: string;
  reservationId: string;
  entryTime: Date;
  exitTime: Date | null;
};

/** US 3: the reservation after a start or end, with its parking session. */
export type ParkingResult = {
  reservation: ReservationRecord;
  session: ParkingSessionRecord;
};

/**
 * Why a start or end was refused: the reservation is no longer in the expected status
 * (e.g. a double click), or the spot or vehicle already has an open session.
 */
export type ParkingConflict = "wrong-status" | "already-parked";

export type ParkingOutcome =
  { ok: true; value: ParkingResult } | { ok: false; conflict: ParkingConflict };

/** US 11: what an edit writes. The route merges the request with the reservation and validates it. */
export type ReservationChanges = Pick<
  ReservationRecord,
  "vehicleId" | "spotId" | "lotId" | "startTime" | "endTime"
>;

/**
 * Why an edit was refused: the reservation is no longer `reserved` (e.g. it was started meanwhile),
 * or the spot or the vehicle is taken in the new window.
 */
export type UpdateConflict = "wrong-status" | "taken";

export type UpdateOutcome =
  | { ok: true; value: ReservationRecord }
  | { ok: false; conflict: UpdateConflict };

// Storage boundary, so the routes can be tested without MongoDB
// (see memory-reservation-store.ts).
export interface ReservationStore {
  listLots(): Promise<ParkingLotRecord[]>;
  findLot(id: string): Promise<ParkingLotRecord | null>;
  listSpots(lotId: string): Promise<ParkingSpotRecord[]>;
  findSpot(id: string): Promise<ParkingSpotRecord | null>;
  /**
   * Spots in the lot that are taken at any moment of the window: by a blocking reservation or a parking session.
   * An open session counts for windows that start by `now` (see `sessionOverlapping`).
   */
  findBusySpotIds(
    lotId: string,
    window: TimeWindow,
    now: Date,
  ): Promise<Set<string>>;
  /**
   * Saves the reservation as `reserved`, unless the spot or the vehicle is already taken in that window.
   * Returns null on such a conflict. Safe when two requests race for the same spot.
   */
  createIfFree(
    input: NewReservation,
    now: Date,
  ): Promise<ReservationRecord | null>;
  /**
   * US 11: writes the changes to a `reserved` reservation, unless another blocking reservation or a
   * parking session takes the spot or the vehicle in the new window (the reservation itself does not count).
   * Safe when it races with a booking, a check-in or another edit of the same reservation.
   */
  updateIfFree(
    id: string,
    changes: ReservationChanges,
    now: Date,
  ): Promise<UpdateOutcome>;
  listByUser(userId: string): Promise<ReservationRecord[]>;
  findById(id: string): Promise<ReservationRecord | null>;
  /**
   * US 3 check-in: opens a parking session at `entryTime`, then `reserved` -> `active`.
   * Safe when two requests race (only one starts it) and when an earlier attempt stopped halfway.
   */
  startParking(id: string, entryTime: Date): Promise<ParkingOutcome>;
  /**
   * US 3 check-out: closes the open session at `exitTime`, then `active` -> `completed`.
   * Safe to retry when an earlier attempt stopped halfway.
   */
  endParking(id: string, exitTime: Date): Promise<ParkingOutcome>;
}

const overlapping = ({ start, end }: TimeWindow) => ({
  status: { $in: BLOCKING_STATUSES },
  startTime: { $lt: end },
  endTime: { $gt: start },
});

const OPEN = { $type: "null" } as const;

// A session blocks its spot from entry until exit. An open session (exitTime null) blocks windows that start by `now`:
// the car is there now, but nobody knows when it leaves. Its active reservation already holds the
// booked window, and a check-in on an occupied spot is refused (startParking).
const sessionOverlapping = ({ start, end }: TimeWindow, now: Date) => ({
  entryTime: { $lt: end },
  $or: [
    { exitTime: { $gt: start } },
    ...(start <= now ? [{ exitTime: OPEN }] : []),
  ],
});

// Matches the unique partial index on vehicleId, so these lookups use it.
const openSessionOf = (reservation: { _id: unknown; vehicleId: string }) => ({
  vehicleId: reservation.vehicleId,
  reservationId: String(reservation._id),
  exitTime: OPEN,
});

export const mongoReservationStore: ReservationStore = {
  async listLots() {
    const docs = await ParkingLotModel.find().sort({ name: 1 }).lean();
    return docs.map(toLot);
  },

  async findLot(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await ParkingLotModel.findById(id).lean();
    return doc ? toLot(doc) : null;
  },

  async listSpots(lotId) {
    const docs = await ParkingSpotModel.find({ lotId })
      .sort({ spotNumber: 1 })
      .lean();
    return docs.map(toSpot);
  },

  async findSpot(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await ParkingSpotModel.findById(id).lean();
    return doc ? toSpot(doc) : null;
  },

  async findBusySpotIds(lotId, window, now) {
    const [reserved, parked] = await Promise.all([
      ReservationModel.distinct("spotId", { lotId, ...overlapping(window) }),
      ParkingSessionModel.distinct("spotId", sessionOverlapping(window, now)),
    ]);
    return new Set([...reserved, ...parked].map(String));
  },

  async createIfFree(input, now) {
    const window = { start: input.startTime, end: input.endTime };
    const taken = {
      ...overlapping(window),
      $or: [{ spotId: input.spotId }, { vehicleId: input.vehicleId }],
    };
    const isParked = () =>
      ParkingSessionModel.exists({
        spotId: input.spotId,
        ...sessionOverlapping(window, now),
      });

    if ((await ReservationModel.exists(taken)) || (await isParked())) {
      return null;
    }

    // MongoDB has no "no overlapping rows" constraint, so insert first and then look for a rival.
    // If two requests race, at least one of them sees the other and backs out, so the spot is
    // never booked twice (in the worst case both back out and the user simply tries again).
    const doc = await ReservationModel.create({ ...input, status: "reserved" });
    const rival = await ReservationModel.exists({
      ...taken,
      _id: { $ne: doc._id },
    });
    if (rival) {
      await ReservationModel.deleteOne({ _id: doc._id });
      return null;
    }
    return toReservation(doc.toObject());
  },

  async updateIfFree(id, changes, now) {
    // Status first, and remember what we read: the edit below only applies if it is still unchanged.
    const current = await ReservationModel.findOne({
      _id: id,
      status: "reserved",
    }).lean();
    if (!current) return { ok: false, conflict: "wrong-status" };

    const window = { start: changes.startTime, end: changes.endTime };
    const takenExcept = (...ids: unknown[]) => ({
      ...overlapping(window),
      $or: [{ spotId: changes.spotId }, { vehicleId: changes.vehicleId }],
      _id: { $nin: ids },
    });
    const isParked = () =>
      ParkingSessionModel.exists({
        spotId: changes.spotId,
        ...sessionOverlapping(window, now),
      });
    if (
      (await ReservationModel.exists(takenExcept(current._id))) ||
      (await isParked())
    ) {
      return { ok: false, conflict: "taken" };
    }

    // Like createIfFree, but without ever undoing a move: hold the new slot with a temporary
    // reservation, look for a rival, and only then move the reservation. Until then it keeps its
    // old slot, so backing out only frees space and never double-books the old slot.
    const hold = await ReservationModel.create({
      userId: current.userId,
      ...changes,
      status: "reserved",
    });
    try {
      if (await ReservationModel.exists(takenExcept(current._id, hold._id))) {
        return { ok: false, conflict: "taken" };
      }
      // Matching on the values we read refuses the edit if a check-in or another edit came first.
      const updated = await ReservationModel.findOneAndUpdate(
        {
          _id: id,
          status: "reserved",
          vehicleId: current.vehicleId,
          spotId: current.spotId,
          startTime: current.startTime,
          endTime: current.endTime,
        },
        changes,
        { new: true },
      ).lean();
      if (!updated) return { ok: false, conflict: "wrong-status" };
      return { ok: true, value: toReservation(updated) };
    } finally {
      await ReservationModel.deleteOne({ _id: hold._id });
    }
  },

  async listByUser(userId) {
    const docs = await ReservationModel.find({ userId })
      .sort({ startTime: -1 })
      .lean();
    return docs.map(toReservation);
  },

  async findById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await ReservationModel.findById(id).lean();
    return doc ? toReservation(doc) : null;
  },

  async startParking(id, entryTime) {
    const reservation = await ReservationModel.findOne({
      _id: id,
      status: "reserved",
    }).lean();
    if (!reservation) return { ok: false, conflict: "wrong-status" };

    // Session first: the unique indexes refuse a second open session on the spot or the vehicle.
    // A session left by an earlier attempt that stopped halfway is reused.
    const leftover = await ParkingSessionModel.findOne(
      openSessionOf(reservation),
    ).lean();
    let session = leftover ? toSession(leftover) : null;
    let created = false;
    if (!session) {
      try {
        const doc = await ParkingSessionModel.create({
          spotId: reservation.spotId,
          vehicleId: reservation.vehicleId,
          reservationId: id,
          entryTime,
        });
        session = toSession(doc.toObject());
        created = true;
      } catch (error) {
        if ((error as { code?: number }).code === 11000) {
          return { ok: false, conflict: "already-parked" };
        }
        throw error;
      }
    }

    // The status filter makes the switch atomic: of two racing requests only one matches.
    const started = await ReservationModel.findOneAndUpdate(
      { _id: id, status: "reserved" },
      { status: "active" },
      { new: true },
    ).lean();
    if (!started) {
      if (created) await ParkingSessionModel.deleteOne({ _id: session.id });
      return { ok: false, conflict: "wrong-status" };
    }
    return {
      ok: true,
      value: {
        reservation: toReservation(started),
        session,
      },
    };
  },

  async endParking(id, exitTime) {
    const reservation = await ReservationModel.findOne({
      _id: id,
      status: "active",
    }).lean();
    if (!reservation) return { ok: false, conflict: "wrong-status" };

    // Session first, so a failure here leaves the reservation active and the user can retry.
    // When an earlier attempt already closed it, nothing matches and we go on.
    await ParkingSessionModel.updateOne(openSessionOf(reservation), {
      exitTime,
    });

    const ended = await ReservationModel.findOneAndUpdate(
      { _id: id, status: "active" },
      { status: "completed" },
      { new: true },
    ).lean();
    if (!ended) return { ok: false, conflict: "wrong-status" };

    const session = await ParkingSessionModel.findOne({
      vehicleId: reservation.vehicleId,
      reservationId: id,
    })
      .sort({ entryTime: -1 })
      .lean();
    if (!session) {
      throw new Error(`Reservation ${id} was active without a parking session`);
    }
    return {
      ok: true,
      value: { reservation: toReservation(ended), session: toSession(session) },
    };
  },
};

function toLot(doc: Omit<ParkingLotRecord, "id"> & { _id: unknown }) {
  return {
    id: String(doc._id),
    name: doc.name,
    address: doc.address,
    totalCapacity: doc.totalCapacity,
    evCapacity: doc.evCapacity,
    disabledCapacity: doc.disabledCapacity,
  };
}

function toSpot(doc: {
  _id: unknown;
  spotNumber: string;
  lotId: string;
  type: string;
  size: string;
  status: string;
}): ParkingSpotRecord {
  return {
    id: String(doc._id),
    spotNumber: doc.spotNumber,
    lotId: doc.lotId,
    type: doc.type as ParkingSpotRecord["type"],
    size: doc.size as ParkingSpotRecord["size"],
    status: doc.status as ParkingSpotRecord["status"],
  };
}

function toReservation(doc: {
  _id: unknown;
  userId: string;
  vehicleId: string;
  spotId: string;
  lotId: string;
  status: string;
  startTime: Date;
  endTime: Date;
}): ReservationRecord {
  return {
    id: String(doc._id),
    userId: doc.userId,
    vehicleId: doc.vehicleId,
    spotId: doc.spotId,
    lotId: doc.lotId,
    status: doc.status as ReservationRecord["status"],
    startTime: doc.startTime,
    endTime: doc.endTime,
  };
}

function toSession(doc: {
  _id: unknown;
  spotId: string;
  vehicleId: string;
  reservationId?: string | null;
  entryTime: Date;
  exitTime?: Date | null;
}): ParkingSessionRecord {
  return {
    id: String(doc._id),
    spotId: doc.spotId,
    vehicleId: doc.vehicleId,
    reservationId: doc.reservationId ?? "",
    entryTime: doc.entryTime,
    exitTime: doc.exitTime ?? null,
  };
}
