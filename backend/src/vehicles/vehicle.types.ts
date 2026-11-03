/** Documented in README and AGENTS.md: combustion / electric. */
export const VEHICLE_ENGINE_TYPES = ["combustion", "electric"] as const;

export type VehicleEngineType = (typeof VEHICLE_ENGINE_TYPES)[number];

/** Documented in README and AGENTS.md. */
export const VEHICLE_SIZES = ["small", "standard", "large"] as const;

export type VehicleSize = (typeof VEHICLE_SIZES)[number];

export type VehicleRecord = {
  id: string;
  licensePlate: string;
  brand: string;
  model: string;
  engineType: VehicleEngineType;
  size: VehicleSize;
  userId: string;
};

export type VehicleFields = Omit<VehicleRecord, "id" | "userId">;
