import mongoose from "mongoose";
import {
  NotificationModel,
  NotificationSettingsModel,
  NOTIFICATION_TYPES,
  type NotificationType,
} from "./notification.model.js";

export type NotificationSettings = Record<NotificationType, boolean>;
export type NotificationRecord = {
  id: string;
  userId: string;
  reservationId: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: Date;
  readAt: Date | null;
  // Deleted reservations may no longer have a detail page; clients should handle 404.
  reservationUrl: string;
};
export type NewNotification = Pick<NotificationRecord, "userId" | "reservationId" | "type" | "title" | "message">;

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  start_soon: true,
  end_soon: true,
  cancelled: true,
  deleted: true,
  spot_unavailable: true,
};

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export interface NotificationStore {
  list(userId: string): Promise<NotificationRecord[]>;
  markRead(userId: string, id: string, at: Date): Promise<boolean>;
  settings(userId: string): Promise<NotificationSettings>;
  changeSettings(userId: string, patch: Partial<NotificationSettings>): Promise<NotificationSettings>;
  /** Respects preferences and inserts at most once per reservation and type. */
  publish(notification: NewNotification, at: Date): Promise<void>;
}

function toRecord(doc: {
  _id: unknown;
  userId: string;
  reservationId: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: Date;
  readAt: Date | null;
}): NotificationRecord {
  return {
    id: String(doc._id),
    userId: doc.userId,
    reservationId: doc.reservationId,
    type: doc.type,
    title: doc.title,
    message: doc.message,
    createdAt: doc.createdAt,
    readAt: doc.readAt,
    reservationUrl: `/reservations/${doc.reservationId}`,
  };
}

export const mongoNotificationStore: NotificationStore = {
  async list(userId) {
    return (await NotificationModel.find({ userId }).sort({ createdAt: -1, _id: -1 }).lean()).map(toRecord);
  },
  async markRead(userId, id, at) {
    if (!mongoose.isValidObjectId(id)) return false;
    const updated = await NotificationModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { readAt: at } },
      { returnDocument: "after" },
    );
    return updated !== null;
  },
  async settings(userId) {
    const doc = await NotificationSettingsModel.findOne({ userId }).lean();
    return Object.fromEntries(NOTIFICATION_TYPES.map((type) => [type, doc?.[type] ?? true])) as NotificationSettings;
  },
  async changeSettings(userId, patch) {
    await NotificationSettingsModel.updateOne(
      { userId },
      { $set: patch, $setOnInsert: { userId } },
      { upsert: true },
    );
    return this.settings(userId);
  },
  async publish(notification, at) {
    const preferences = await this.settings(notification.userId);
    if (!preferences[notification.type]) return;
    try {
      await NotificationModel.updateOne(
        { reservationId: notification.reservationId, type: notification.type },
        { $setOnInsert: { ...notification, createdAt: at, readAt: null } },
        { upsert: true },
      );
    } catch (error) {
      // A second worker may have won the unique-index race.
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  },
};

/** Used for route tests, without a MongoDB server. */
export function memoryNotificationStore(): NotificationStore {
  const notifications: NotificationRecord[] = [];
  const settings = new Map<string, NotificationSettings>();
  let nextId = 1;
  return {
    async list(userId) {
      return notifications.filter((n) => n.userId === userId).map((n) => ({ ...n }));
    },
    async markRead(userId, id, at) {
      const record = notifications.find((n) => n.userId === userId && n.id === id);
      if (!record) return false;
      record.readAt = at;
      return true;
    },
    async settings(userId) {
      return { ...(settings.get(userId) ?? DEFAULT_NOTIFICATION_SETTINGS) };
    },
    async changeSettings(userId, patch) {
      const next = { ...(settings.get(userId) ?? DEFAULT_NOTIFICATION_SETTINGS), ...patch };
      settings.set(userId, next);
      return { ...next };
    },
    async publish(notification, at) {
      if (!(settings.get(notification.userId) ?? DEFAULT_NOTIFICATION_SETTINGS)[notification.type]) return;
      if (notifications.some((n) => n.reservationId === notification.reservationId && n.type === notification.type)) return;
      notifications.unshift({
        ...notification,
        id: (nextId++).toString(16).padStart(24, "0"),
        createdAt: at,
        readAt: null,
        reservationUrl: `/reservations/${notification.reservationId}`,
      });
    },
  };
}
