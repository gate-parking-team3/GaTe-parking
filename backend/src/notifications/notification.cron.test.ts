import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { ReservationModel } from "../parks/reservation.model.js";
import type { NotificationStore } from "./notification.store.js";
import {
  checkNotificationEvents,
  SCHEDULED_CANCEL_LOOKBACK_MS,
} from "./notification.worker.js";

describe("GET /api/cron/notifications", () => {
  const secret = "test-cron-secret";

  it("runs the notification check when the secret matches", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const app = createApp({ cronSecret: secret, runNotificationCheck: run });

    const res = await request(app)
      .get("/api/cron/notifications")
      .set("Authorization", `Bearer ${secret}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("refuses a request without the secret", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const app = createApp({ cronSecret: secret, runNotificationCheck: run });

    const res = await request(app).get("/api/cron/notifications");

    expect(res.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const app = createApp({ cronSecret: secret, runNotificationCheck: run });

    const res = await request(app)
      .get("/api/cron/notifications")
      .set("Authorization", "Bearer something-else");

    expect(res.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("refuses every request when no secret is configured", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const app = createApp({ cronSecret: undefined, runNotificationCheck: run });

    const res = await request(app)
      .get("/api/cron/notifications")
      .set("Authorization", "Bearer ");

    expect(res.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("answers 500 without details when the check fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const run = vi.fn().mockRejectedValue(new Error("database is down"));
    const app = createApp({ cronSecret: secret, runNotificationCheck: run });

    const res = await request(app)
      .get("/api/cron/notifications")
      .set("Authorization", `Bearer ${secret}`);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Something went wrong" });
  });
});

describe("checkNotificationEvents cancellation lookback", () => {
  const now = new Date("2026-11-25T10:00:00Z");
  const store = {} as NotificationStore;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function cancelledCutoff(call: unknown): Date {
    const query = call as {
      $or: { status?: string; updatedAt?: { $gte: Date } }[];
    };
    const clause = query.$or.find((part) => part.status === "cancelled");
    if (!clause?.updatedAt) throw new Error("no cancelled clause");
    return clause.updatedAt.$gte;
  }

  function spyOnFind() {
    return vi.spyOn(ReservationModel, "find").mockReturnValue({
      lean: () => Promise.resolve([]),
    } as never);
  }

  it("looks back two minutes by default (the one-minute timer)", async () => {
    const find = spyOnFind();

    await checkNotificationEvents(now, store);

    expect(cancelledCutoff(find.mock.calls[0]?.[0])).toEqual(
      new Date("2026-11-25T09:58:00Z"),
    );
  });

  it("looks back an hour for the scheduled job", async () => {
    const find = spyOnFind();

    await checkNotificationEvents(now, store, SCHEDULED_CANCEL_LOOKBACK_MS);

    expect(cancelledCutoff(find.mock.calls[0]?.[0])).toEqual(
      new Date("2026-11-25T09:00:00Z"),
    );
  });
});
