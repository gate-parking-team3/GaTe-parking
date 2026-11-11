import type { User } from "../types/auth";
import { apiClient } from "./client";

type LoginRequest = { email: string; password: string };
type LoginResponse = { token: string; user: User };
type MeResponse = { user: User };

export const authApi = {
  login: (credentials: LoginRequest) =>
    apiClient.post<LoginResponse>("/auth/login", credentials),
  me: () => apiClient.get<MeResponse>("/auth/me"),
};
