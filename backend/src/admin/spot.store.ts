import mongoose from "mongoose";
import { ParkingLotModel } from "../parks/parkingLot.model.js";
import { ParkingSpotModel } from "../parks/parkingSpot.model.js";
import type { ParkingSpotRecord } from "../parks/parkingSpot.types.js";
import type { ParkingLotRecord } from "../reservations/reservation.store.js";
import { DuplicateSpotNumberError } from "./spot.errors.js";

export type { ParkingLotRecord };

export type NewParkingSpot = Omit<ParkingSpotRecord, "id">;

export type SpotCounts = {
  total: number;
  standard: number;
  ev: number;
  disabled: number;
};

export interface ParkingLotLookup {
  findById(id: string): Promise<ParkingLotRecord | null>;
}

export interface AdminSpotStore {
  list(lotId?: string): Promise<ParkingSpotRecord[]>;
  insert(input: NewParkingSpot): Promise<ParkingSpotRecord>;
  count(lotId: string): Promise<SpotCounts>;
  deleteById(id: string): Promise<void>;
}

export const mongoParkingLotLookup: ParkingLotLookup = {
  async findById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await ParkingLotModel.findById(id).lean();
    if (!doc) return null;
    return {
      id: String(doc._id),
      name: doc.name,
      address: doc.address,
      totalCapacity: doc.totalCapacity,
      evCapacity: doc.evCapacity,
      disabledCapacity: doc.disabledCapacity,
    };
  },
};

export const mongoAdminSpotStore: AdminSpotStore = {
  async list(lotId) {
    const filter = lotId === undefined ? {} : { lotId };
    const docs = await ParkingSpotModel.find(filter)
      .sort({ spotNumber: 1, lotId: 1 })
      .lean();
    return docs.map(toSpot);
  },

  async insert(input) {
    try {
      const doc = await ParkingSpotModel.create(input);
      return toSpot(doc);
    } catch (error) {
      if (isDuplicateKey(error)) throw new DuplicateSpotNumberError();
      throw error;
    }
  },

  async count(lotId) {
    const docs = await ParkingSpotModel.find({ lotId }).select("type").lean();
    const counts: SpotCounts = {
      total: docs.length,
      standard: 0,
      ev: 0,
      disabled: 0,
    };
    for (const doc of docs) {
      if (
        doc.type === "standard" ||
        doc.type === "ev" ||
        doc.type === "disabled"
      ) {
        counts[doc.type] += 1;
      }
    }
    return counts;
  },

  async deleteById(id) {
    if (!mongoose.isValidObjectId(id)) return;
    await ParkingSpotModel.deleteOne({ _id: id });
  },
};

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

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}
