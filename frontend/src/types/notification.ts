export const NOTIFICATION_TYPES = [
  "start_soon",
  "end_soon",
  "cancelled",
  "deleted",
  "spot_unavailable",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationSettings = Record<NotificationType, boolean>;

export interface NotificationRecord {
  id: string;
  userId: string;
  reservationId: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  reservationUrl: string;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  start_soon: true,
  end_soon: true,
  cancelled: true,
  deleted: true,
  spot_unavailable: true,
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  start_soon: "Reservation starts soon (e.g. 30 min before)",
  end_soon: "Reservation or session ends soon (e.g. 15 min before)",
  cancelled: "Reservation is cancelled",
  deleted: "Reservation is deleted (e.g. by an admin)",
  spot_unavailable: "Reserved spot is not available",
};
