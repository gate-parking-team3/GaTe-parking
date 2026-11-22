import type { User } from "../types/auth";
import { apiClient } from "./client";

export type RegisterEmployeeRequest = {
  name: string;
  email: string;
};

export type RegisterEmployeeResponse = {
  employee: User;
};

export type ListEmployeesResponse = {
  employees: User[];
};

export type DevInvitationResponse = {
  activationUrl: string;
  expiresAt: string;
};

export const employeeApi = {
  list: () => apiClient.get<ListEmployeesResponse>("/admin/employees"),
  register: (data: RegisterEmployeeRequest) =>
    apiClient.post<RegisterEmployeeResponse>("/admin/employees", data),
  getDevInvitation: (email: string) =>
    apiClient.get<DevInvitationResponse>(
      `/dev/invitations/${encodeURIComponent(email)}`,
    ),
};
