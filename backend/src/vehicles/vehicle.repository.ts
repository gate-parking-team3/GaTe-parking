import type { VehicleFields, VehicleRecord } from "./vehicle.types.js";
import { VehicleModel } from "./vehicle.model.js";

export type VehicleUpdateFields = Partial<VehicleFields>;

export interface VehicleRepository {
  listByOwner(userId: string): Promise<VehicleRecord[]>;
  create(input: VehicleFields & { userId: string }): Promise<VehicleRecord>;
  findById(id: string): Promise<VehicleRecord | null>;
  update(id: string, patch: VehicleUpdateFields): Promise<VehicleRecord | null>;
  deleteById(id: string): Promise<boolean>;
}

export class DuplicateLicensePlateError extends Error {
  constructor() {
    super("License plate is already registered");
    this.name = "DuplicateLicensePlateError";
  }
}

export const mongoVehicleRepository: VehicleRepository = {
  async listByOwner(userId) {
    const docs = await VehicleModel.find({ userId }).lean();
    return docs.map(toVehicleRecord);
  },

  async create(input) {
    try {
      const doc = await VehicleModel.create(input);
      return toVehicleRecord(doc);
    } catch (error) {
      if (isDuplicateKey(error)) throw new DuplicateLicensePlateError();
      throw error;
    }
  },

  async findById(id) {
    const doc = await VehicleModel.findById(id).lean();
    return doc ? toVehicleRecord(doc) : null;
  },

  async update(id, patch) {
    try {
      const doc = await VehicleModel.findByIdAndUpdate(id, patch, {
        returnDocument: "after",
        runValidators: true,
      }).lean();
      return doc ? toVehicleRecord(doc) : null;
    } catch (error) {
      if (isDuplicateKey(error)) throw new DuplicateLicensePlateError();
      throw error;
    }
  },

  async deleteById(id) {
    const doc = await VehicleModel.findByIdAndDelete(id).lean();
    return doc !== null;
  },
};

function toVehicleRecord(doc: {
  _id: unknown;
  licensePlate: string;
  brand: string;
  model: string;
  engineType: string;
  size: string;
  userId: string;
}): VehicleRecord {
  return {
    id: String(doc._id),
    licensePlate: doc.licensePlate,
    brand: doc.brand,
    model: doc.model,
    engineType: doc.engineType as VehicleRecord["engineType"],
    size: doc.size as VehicleRecord["size"],
    userId: doc.userId,
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
