export type EngineType = "combustion" | "electric";

export type VehicleSize = "small" | "standard" | "large";

export interface Vehicle {
  id: string;
  licensePlate: string;
  brand: string;
  model: string;
  engineType: EngineType;
  size: VehicleSize;
}

export type VehicleInput = Omit<Vehicle, "id">;
