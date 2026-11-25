import type { ParkingSpot } from "./reservation";

export interface LotAvailability {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
}

export interface ParkingLot {
  id: string;
  name: string;
  address: string;
  totalCapacity: number;
  evCapacity: number;
  disabledCapacity: number;
  availability: LotAvailability;
}

export interface ParkingLotDetail extends ParkingLot {
  spots: ParkingSpot[];
}
