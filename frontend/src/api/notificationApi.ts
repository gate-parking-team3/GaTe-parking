import type {
  NotificationRecord,
  NotificationSettings,
} from "../types/notification";
import { apiClient } from "./client";

export const notificationApi = {
  list: () => apiClient.get<NotificationRecord[]>("/notifications"),
  markRead: (id: string) =>
    apiClient.patch<void>(
      `/notifications/${encodeURIComponent(id)}/read`,
      undefined,
    ),
  settings: () =>
    apiClient.get<NotificationSettings>("/notifications/settings"),
  updateSettings: (settings: Partial<NotificationSettings>) =>
    apiClient.patch<NotificationSettings>("/notifications/settings", settings),
};
