import type { VehicleSize } from "./vehicle";

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

// Only a reserved booking whose start is still ahead can be edited (US 11).
export function isEditableReservation(
  reservation: Reservation,
  now: Date = new Date(),
): boolean {
  return (
    reservation.status === "reserved" &&
    new Date(reservation.startTime).getTime() > now.getTime()
  );
}
