import { ParkingSessionModel } from "../parks/parkingSession.model.js";
import { ParkingSpotModel } from "../parks/parkingSpot.model.js";
import type { QueryFilter } from "mongoose";
import {
  ReservationModel,
  type ReservationSchemaFields,
} from "../parks/reservation.model.js";
import {
  mongoNotificationStore,
  type NotificationStore,
  type NewNotification,
} from "./notification.store.js";

const MINUTE = 60_000;

export type CheckedReservation = {
  id: string;
  userId: string;
  spotId: string;
  vehicleId: string;
  status: "reserved" | "active" | "cancelled";
  startTime: Date;
  endTime: Date;
};

/** Pure calculation; the unique DB index prevents duplicates across ticks/restarts. */
export function dueNotifications(
  reservation: CheckedReservation,
  now: Date,
  spotUnavailable = false,
): NewNotification[] {
  const result: NewNotification[] = [];
  const add = (
    type: NewNotification["type"],
    title: string,
    message: string,
  ) => {
    result.push({
      userId: reservation.userId,
      reservationId: reservation.id,
      type,
      title,
      message,
    });
  };
  const untilStart = reservation.startTime.getTime() - now.getTime();
  const untilEnd = reservation.endTime.getTime() - now.getTime();

  if (reservation.status === "cancelled") {
    add(
      "cancelled",
      "Reservation cancelled",
      "Your parking reservation was cancelled.",
    );
    return result;
  }
  if (
    reservation.status === "reserved" &&
    untilStart >= 0 &&
    untilStart <= 30 * MINUTE
  ) {
    add(
      "start_soon",
      "Parking starts soon",
      "Your reservation starts in 30 minutes or less.",
    );
  }
  if (untilEnd >= 0 && untilEnd <= 15 * MINUTE) {
    add(
      "end_soon",
      "Parking ends soon",
      "Your reservation or parking session ends in 15 minutes or less.",
    );
  }
  if (spotUnavailable) {
    add(
      "spot_unavailable",
      "Reserved spot unavailable",
      "Another vehicle is occupying your reserved parking spot.",
    );
  }
  return result;
}

/** Runs once, independent of HTTP requests. */
export async function checkNotificationEvents(
  now = new Date(),
  store: NotificationStore = mongoNotificationStore,
): Promise<void> {
  const soon = new Date(now.getTime() + 30 * MINUTE);
  const query: QueryFilter<ReservationSchemaFields> = {
    holdExpiresAt: { $exists: false },
    $or: [
      // Only recent cancellations, so old ones are not re-sent or loaded on every tick.
      {
        status: "cancelled",
        updatedAt: { $gte: new Date(now.getTime() - 2 * MINUTE) },
      },
      { status: "reserved", startTime: { $gte: now, $lte: soon } },
      {
        status: { $in: ["reserved", "active"] },
        endTime: { $gte: now, $lte: new Date(now.getTime() + 15 * MINUTE) },
      },
      // Detect occupied spots during the reservation window, not only at its start/end.
      {
        status: { $in: ["reserved", "active"] },
        startTime: { $lte: now },
        endTime: { $gt: now },
      },
    ],
  };
  const reservations = await ReservationModel.find(query).lean();
  if (!reservations.length) return;

  const inWindow = reservations.filter(
    (r) => r.status !== "cancelled" && r.startTime <= now && r.endTime > now,
  );
  const spotIds = [...new Set(inWindow.map((r) => r.spotId))];
  const [sessions, spotDocs] = await Promise.all([
    spotIds.length
      ? ParkingSessionModel.find({
          spotId: { $in: spotIds },
          exitTime: null,
        }).lean()
      : Promise.resolve([]),
    spotIds.length
      ? ParkingSpotModel.find({
          _id: { $in: spotIds },
          status: "occupied",
        }).lean()
      : Promise.resolve([]),
  ]);
  const sessionsBySpot = new Map(sessions.map((s) => [s.spotId, s]));
  const occupiedFlags = new Set(spotDocs.map((s) => String(s._id)));

  for (const r of reservations) {
    const occupied = sessionsBySpot.get(r.spotId);
    const spotUnavailable =
      r.status !== "cancelled" &&
      r.startTime <= now &&
      r.endTime > now &&
      (occupied
        ? occupied.reservationId !== String(r._id)
        : occupiedFlags.has(r.spotId));
    const events = dueNotifications(
      {
        id: String(r._id),
        userId: r.userId,
        spotId: r.spotId,
        vehicleId: r.vehicleId,
        status: r.status as CheckedReservation["status"],
        startTime: r.startTime,
        endTime: r.endTime,
      },
      now,
      spotUnavailable,
    );
    for (const event of events) await store.publish(event, now);
  }
}

/** Start once after MongoDB connects; no overlap between ticks. */
export function startNotificationScheduler(intervalMs = MINUTE): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await checkNotificationEvents();
    } catch (error) {
      console.error("Notification check failed", error);
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

/** Call after a successful US 6 DELETE, while the deleted reservation snapshot still exists. */
export async function notifyReservationDeleted(
  reservation: { id: string; userId: string },
  store: NotificationStore = mongoNotificationStore,
  now = new Date(),
): Promise<void> {
  await store.publish(
    {
      userId: reservation.userId,
      reservationId: reservation.id,
      type: "deleted",
      title: "Reservation deleted",
      message: "Your parking reservation was deleted.",
    },
    now,
  );
}
