import type {
  CurrentReservation,
  ParkingLot,
  ParkingSpot,
  Reservation,
  ReservationInput,
  ReservationUpdate,
} from "../types/reservation";
import { apiClient } from "./client";

export type AvailableSpotsQuery = {
  vehicleId: string;
  start: string;
  end: string;
  evOnly?: boolean;
};

export const reservationApi = {
  lots: () => apiClient.get<ParkingLot[]>("/lots"),
  create: (reservation: ReservationInput) =>
    apiClient.post<Reservation>("/reservations", reservation),
  mine: () => apiClient.get<Reservation[]>("/reservations/mine"),
  current: () => apiClient.get<CurrentReservation[]>("/reservations/active"),
  get: (id: string) =>
    apiClient.get<Reservation>(`/reservations/${encodeURIComponent(id)}`),
  update: (id: string, changes: ReservationUpdate) =>
    apiClient.patch<Reservation>(
      `/reservations/${encodeURIComponent(id)}`,
      changes,
    ),
  remove: (id: string) =>
    apiClient.delete(`/reservations/${encodeURIComponent(id)}`),
  availableSpots: async (
    lotId: string,
    { evOnly, ...query }: AvailableSpotsQuery,
  ) => {
    const params = new URLSearchParams(query);
    if (evOnly) params.set("evOnly", "true");
    const result = await apiClient.get<{ spots: ParkingSpot[] }>(
      `/lots/${encodeURIComponent(lotId)}/available-spots?${params.toString()}`,
    );
    return result.spots;
  },
};
