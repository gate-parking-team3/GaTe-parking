export type EngineType = "combustion" | "plug-in";

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

export const LICENSE_PLATE_MAX_LENGTH = 12;

const LICENSE_PLATE_PATTERN = new RegExp(
  `^[A-Za-z0-9]{1,${LICENSE_PLATE_MAX_LENGTH}}$`,
);

export function isValidLicensePlate(plate: string): boolean {
  return LICENSE_PLATE_PATTERN.test(plate);
}
