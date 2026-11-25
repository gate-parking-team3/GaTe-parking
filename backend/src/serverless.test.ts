import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withLazyDb } from "./serverless.js";

function api() {
  const app = express();
  app.get("/api/health", (_req, res) => {
    res.json({ status: "degraded" });
  });
  app.get("/api/things", (_req, res) => {
    res.json({ things: [] });
  });
  return app;
}

describe("withLazyDb", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("connects once and reuses the connection", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const app = withLazyDb(api(), connect);

    await request(app).get("/api/things").expect(200);
    await request(app).get("/api/things").expect(200);

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("answers 503 on data routes while the database is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = withLazyDb(api(), () => Promise.reject(new Error("down")));

    const res = await request(app).get("/api/things");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "Database unavailable" });
  });

  it("still lets the health check answer while the database is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = withLazyDb(api(), () => Promise.reject(new Error("down")));

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "degraded" });
  });

  it("tries again on the next request after a failed connection", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue(undefined);
    const app = withLazyDb(api(), connect);

    await request(app).get("/api/things").expect(503);
    await request(app).get("/api/things").expect(200);

    expect(connect).toHaveBeenCalledTimes(2);
  });
});
