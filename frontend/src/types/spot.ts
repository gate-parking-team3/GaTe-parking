import type { VehicleSize } from "./vehicle";

export type ParkingSpotType = "standard" | "disabled" | "ev";
export type ParkingSpotSize = VehicleSize;
export type ParkingSpotStatus = "free" | "reserved" | "occupied";

export interface ParkingSpot {
  id: string;
  spotNumber: string;
  lotId: string;
  type: ParkingSpotType;
  size: VehicleSize;
  status: ParkingSpotStatus;
}

export interface CreateSpotInput {
  spotNumber: string;
  lotId: string;
  type: ParkingSpotType;
  size: VehicleSize;
  status?: ParkingSpotStatus;
}

export interface ParkingLot {
  id: string;
  name: string;
  address: string;
  totalCapacity: number;
  evCapacity: number;
  disabledCapacity: number;
}
