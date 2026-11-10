import type {
  ParkingSpot,
  Reservation,
  ReservationUpdate,
} from "../types/reservation";
import { apiClient } from "./client";

export type AvailableSpotsQuery = {
  vehicleId: string;
  start: string;
  end: string;
};

export const reservationApi = {
  mine: () => apiClient.get<Reservation[]>("/reservations/mine"),
  get: (id: string) =>
    apiClient.get<Reservation>(`/reservations/${encodeURIComponent(id)}`),
  update: (id: string, changes: ReservationUpdate) =>
    apiClient.patch<Reservation>(
      `/reservations/${encodeURIComponent(id)}`,
      changes,
    ),
  availableSpots: async (lotId: string, query: AvailableSpotsQuery) => {
    const params = new URLSearchParams(query);
    const result = await apiClient.get<{ spots: ParkingSpot[] }>(
      `/lots/${encodeURIComponent(lotId)}/available-spots?${params.toString()}`,
    );
    return result.spots;
  },
};
