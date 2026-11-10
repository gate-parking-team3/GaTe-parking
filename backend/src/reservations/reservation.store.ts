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

// Storage boundary, so the routes can be tested without MongoDB
// (see memory-reservation-store.ts).
export interface ReservationStore {
  listLots(): Promise<ParkingLotRecord[]>;
  findLot(id: string): Promise<ParkingLotRecord | null>;
  listSpots(lotId: string): Promise<ParkingSpotRecord[]>;
  findSpot(id: string): Promise<ParkingSpotRecord | null>;
  /** Spots in the lot that are taken at any moment of the window: by a blocking reservation or a parking session. */
  findBusySpotIds(lotId: string, window: TimeWindow): Promise<Set<string>>;
  /**
   * Saves the reservation as `reserved`, unless the spot or the vehicle is already taken in that window.
   * Returns null on such a conflict. Safe when two requests race for the same spot.
   */
  createIfFree(input: NewReservation): Promise<ReservationRecord | null>;
  listByUser(userId: string): Promise<ReservationRecord[]>;
  findById(id: string): Promise<ReservationRecord | null>;
}

const overlapping = ({ start, end }: TimeWindow) => ({
  status: { $in: BLOCKING_STATUSES },
  startTime: { $lt: end },
  endTime: { $gt: start },
});

// A session blocks its spot from entry until exit; an open session (exitTime null) blocks it from entry on.
const sessionOverlapping = ({ start, end }: TimeWindow) => ({
  entryTime: { $lt: end },
  $or: [{ exitTime: null }, { exitTime: { $gt: start } }],
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

  async findBusySpotIds(lotId, window) {
    const [reserved, parked] = await Promise.all([
      ReservationModel.distinct("spotId", { lotId, ...overlapping(window) }),
      ParkingSessionModel.distinct("spotId", sessionOverlapping(window)),
    ]);
    return new Set([...reserved, ...parked].map(String));
  },

  async createIfFree(input) {
    const window = { start: input.startTime, end: input.endTime };
    const taken = {
      ...overlapping(window),
      $or: [{ spotId: input.spotId }, { vehicleId: input.vehicleId }],
    };
    const isParked = () =>
      ParkingSessionModel.exists({
        spotId: input.spotId,
        ...sessionOverlapping(window),
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
