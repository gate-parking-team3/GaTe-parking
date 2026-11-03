import type { Vehicle, VehicleInput } from "../types/vehicle";
import { apiClient } from "./client";

export const vehicleApi = {
  list: () => apiClient.get<Vehicle[]>("/vehicles"),
  get: (id: string) =>
    apiClient.get<Vehicle>(`/vehicles/${encodeURIComponent(id)}`),
  create: (vehicle: VehicleInput) =>
    apiClient.post<Vehicle>("/vehicles", vehicle),
  update: (id: string, vehicle: VehicleInput) =>
    apiClient.put<Vehicle>(`/vehicles/${encodeURIComponent(id)}`, vehicle),
  remove: (id: string) =>
    apiClient.delete(`/vehicles/${encodeURIComponent(id)}`),
};
