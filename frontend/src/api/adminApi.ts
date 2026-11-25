import type { AuditLogEntry } from "../types/audit";
import type { CreateSpotInput, ParkingLot, ParkingSpot } from "../types/spot";
import { apiClient } from "./client";

export const adminApi = {
  listLots: () => apiClient.get<ParkingLot[]>("/lots"),
  listSpots: (lotId?: string) =>
    apiClient.get<{ spots: ParkingSpot[] }>(
      lotId
        ? `/admin/spots?lotId=${encodeURIComponent(lotId)}`
        : "/admin/spots",
    ),
  createSpot: (spot: CreateSpotInput) =>
    apiClient.post<{ spot: ParkingSpot }>("/admin/spots", spot),
  listAuditLogs: () =>
    apiClient.get<{ logs: AuditLogEntry[] }>("/admin/audit-logs"),
};
