// Parking spot types: standard, disabled, EV
export const PARKING_SPOT_TYPES = ["standard", "disabled", "ev"] as const;
export type ParkingSpotType = (typeof PARKING_SPOT_TYPES)[number];

// Spot size categories
export const PARKING_SPOT_SIZES = ["small", "standard", "large"] as const;
export type ParkingSpotSize = (typeof PARKING_SPOT_SIZES)[number];

// Spot status: free (available), reserved (booked), occupied (in use)
export const PARKING_SPOT_STATUSES = ["free", "reserved", "occupied"] as const;
export type ParkingSpotStatus = (typeof PARKING_SPOT_STATUSES)[number];

// Parking spot record
export type ParkingSpotRecord = {
  id: string;
  spotNumber: string;
  lotId: string;
  type: ParkingSpotType;
  size: ParkingSpotSize;
  status: ParkingSpotStatus;
};

// Fields for creating/updating a spot (id excluded)
export type ParkingSpotFields = Omit<ParkingSpotRecord, "id" | "status"> & {
  status?: ParkingSpotStatus;
};
