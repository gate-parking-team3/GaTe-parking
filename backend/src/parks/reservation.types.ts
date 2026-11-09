// Reservation statuses: reserved (booked), active (parking started), completed, cancelled
export const RESERVATION_STATUSES = [
  "reserved",
  "active",
  "completed",
  "cancelled",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

// Reservation record
export type ReservationRecord = {
  id: string;
  userId: string;
  vehicleId: string;
  spotId: string;
  lotId: string;
  status: ReservationStatus;
  startTime: Date;
  endTime: Date;
  createdAt: Date;
  updatedAt: Date;
};

// Fields for creating/updating a reservation
export type ReservationFields = Omit<
  ReservationRecord,
  "id" | "status" | "createdAt" | "updatedAt"
> & {
  status?: ReservationStatus;
  createdAt?: Date;
  updatedAt?: Date;
};
