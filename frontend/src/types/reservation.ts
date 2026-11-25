import type { Vehicle, VehicleSize } from "./vehicle";

export type ReservationStatus =
  "reserved" | "active" | "completed" | "cancelled";

export interface Reservation {
  id: string;
  userId: string;
  vehicleId: string;
  spotId: string;
  lotId: string;
  status: ReservationStatus;
  startTime: string;
  endTime: string;
}

export type ReservationInput = Pick<
  Reservation,
  "vehicleId" | "spotId" | "startTime" | "endTime"
>;

export type ReservationUpdate = Partial<
  Pick<Reservation, "vehicleId" | "spotId" | "startTime" | "endTime">
>;

export type ParkingSpotType = "standard" | "disabled" | "ev";

export interface ParkingSpot {
  id: string;
  spotNumber: string;
  lotId: string;
  type: ParkingSpotType;
  size: VehicleSize;
  status: "free" | "reserved" | "occupied";
}

export interface ParkingLot {
  id: string;
  name: string;
  address: string;
  totalCapacity: number;
  evCapacity: number;
  disabledCapacity: number;
}

// An upcoming or in-progress reservation from GET /api/reservations/active (US 7).
// The vehicle or spot is null when it can no longer be loaded.
export interface CurrentReservation {
  id: string;
  status: ReservationStatus;
  startTime: string;
  endTime: string;
  vehicle: Omit<Vehicle, "userId"> | null;
  parkingSpot: Omit<ParkingSpot, "status"> | null;
}

// Only a reserved booking whose start is still ahead can be edited (US 11).
export function isEditableReservation(
  reservation: Pick<Reservation, "status" | "startTime">,
  now: Date = new Date(),
): boolean {
  return (
    reservation.status === "reserved" &&
    new Date(reservation.startTime).getTime() > now.getTime()
  );
}
