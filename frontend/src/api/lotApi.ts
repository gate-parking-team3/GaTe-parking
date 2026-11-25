import type { ParkingLot, ParkingLotDetail } from "../types/lot";
import { apiClient } from "./client";

export const lotApi = {
  list: () => apiClient.get<ParkingLot[]>("/lots"),
  get: (id: string) =>
    apiClient.get<ParkingLotDetail>(`/lots/${encodeURIComponent(id)}`),
};
