import express, { type RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createNotificationRouter } from "./notification.routes.js";
import { dueNotifications, notifyReservationDeleted } from "./notification.worker.js";
import { memoryNotificationStore } from "./notification.store.js";

const ANNA = "aaaaaaaaaaaaaaaaaaaaaaaa";
const PETR = "bbbbbbbbbbbbbbbbbbbbbbbb";
const BOOKING = "cccccccccccccccccccccccc";
const NOW = new Date("2026-11-10T08:00:00.000Z");

function fixture() {
  const store = memoryNotificationStore();
  const appFor = (userId?: string) => {
    const auth: RequestHandler = (req, _res, next) => {
      if (userId) Object.assign(req, { user: { id: userId, role: "user" } });
      next();
    };
    const app = express();
    app.use(express.json());
    app.use(auth);
    app.use("/api/notifications", createNotificationRouter(store));
    return app;
  };
  return { store, appFor };
}

const booked = {
  id: BOOKING,
  userId: ANNA,
  spotId: "dddddddddddddddddddddddd",
  vehicleId: "eeeeeeeeeeeeeeeeeeeeeeee",
  status: "reserved" as const,
  startTime: new Date("2026-11-10T08:30:00.000Z"),
  endTime: new Date("2026-11-10T10:00:00.000Z"),
};

describe("notification events", () => {
  it("recognizes start, end, cancellation and unavailable spot", () => {
    expect(dueNotifications(booked, NOW, true).map((n) => n.type)).toEqual(["start_soon", "spot_unavailable"]);
    expect(dueNotifications({ ...booked, endTime: new Date("2026-11-10T08:15:00Z") }, NOW).map((n) => n.type)).toContain("end_soon");
    expect(dueNotifications({ ...booked, status: "cancelled" }, NOW).map((n) => n.type)).toEqual(["cancelled"]);
  });

  it("does not warn before the notification windows or after the reservation", () => {
    const future = { ...booked, startTime: new Date("2026-11-10T09:00:00Z"), endTime: new Date("2026-11-10T10:00:00Z") };
    expect(dueNotifications(future, NOW)).toEqual([]);
    expect(dueNotifications({ ...booked, startTime: new Date("2026-11-10T06:00:00Z"), endTime: new Date("2026-11-10T07:00:00Z") }, NOW)).toEqual([]);
  });
});

describe("notification API", () => {
  it("defaults all settings on and allows toggling individual types", async () => {
    const { appFor } = fixture();
    const initial = await request(appFor(ANNA)).get("/api/notifications/settings");
    expect(initial.body).toEqual({ start_soon: true, end_soon: true, cancelled: true, deleted: true, spot_unavailable: true });
    const updated = await request(appFor(ANNA)).patch("/api/notifications/settings").send({ deleted: false });
    expect(updated.status).toBe(200);
    expect(updated.body.deleted).toBe(false);
    expect((await request(appFor(PETR)).get("/api/notifications/settings")).body.deleted).toBe(true);
    expect((await request(appFor(ANNA)).patch("/api/notifications/settings").send({ bad: true })).status).toBe(400);
    expect((await request(appFor(ANNA)).patch("/api/notifications/settings").send({ deleted: "false" })).status).toBe(400);
    expect((await request(appFor(ANNA)).patch("/api/notifications/settings").send({})).status).toBe(400);
  });

  it("persists one notification per reservation/type, allows reading only own", async () => {
    const { appFor, store } = fixture();
    await notifyReservationDeleted({ id: BOOKING, userId: ANNA }, store, NOW);
    await notifyReservationDeleted({ id: BOOKING, userId: ANNA }, store, NOW);
    const list = await request(appFor(ANNA)).get("/api/notifications");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toEqual(expect.objectContaining({ type: "deleted", reservationUrl: `/reservations/${BOOKING}`, readAt: null }));
    const id = list.body[0].id as string;
    expect((await request(appFor(PETR)).patch(`/api/notifications/${id}/read`)).status).toBe(404);
    expect((await request(appFor(ANNA)).patch(`/api/notifications/${id}/read`)).status).toBe(204);
    expect((await request(appFor(ANNA)).get("/api/notifications")).body[0].readAt).not.toBeNull();
    expect((await request(appFor(ANNA)).patch("/api/notifications/not-an-id/read")).status).toBe(400);
  });

  it("respects notification preferences, authentication and account isolation", async () => {
    const { appFor, store } = fixture();
    await store.changeSettings(ANNA, { deleted: false });
    await notifyReservationDeleted({ id: BOOKING, userId: ANNA }, store, NOW);
    expect((await request(appFor(ANNA)).get("/api/notifications")).body).toEqual([]);
    expect((await request(appFor(PETR)).get("/api/notifications")).body).toEqual([]);
    expect((await request(appFor()).get("/api/notifications")).status).toBe(401);
    expect((await request(appFor()).get("/api/notifications/settings")).status).toBe(401);
  });
});
