export type EngineType = "combustion" | "electric";

export type VehicleSize = "small" | "standard" | "large";

export interface Vehicle {
  id: string;
  userId: string;
  licensePlate: string;
  brand: string;
  model: string;
  engineType: EngineType;
  size: VehicleSize;
}

export type VehicleInput = Omit<Vehicle, "id" | "userId">;

// Same rules as the backend: spaces and hyphens are ignored, 2-12 letters or digits remain.
export const LICENSE_PLATE_MIN_LENGTH = 2;
export const LICENSE_PLATE_MAX_LENGTH = 12;

const LICENSE_PLATE_PATTERN = /^[A-Za-z0-9 -]+$/;

export function isValidLicensePlate(plate: string): boolean {
  if (!LICENSE_PLATE_PATTERN.test(plate)) return false;
  const length = plate.replace(/[ -]/g, "").length;
  return (
    length >= LICENSE_PLATE_MIN_LENGTH && length <= LICENSE_PLATE_MAX_LENGTH
  );
}
