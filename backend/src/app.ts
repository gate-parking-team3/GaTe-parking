import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { employeesRouter } from "./admin/employees.routes.js";
import { authRouter } from "./auth/auth.routes.js";
import { requireAuth, requireRole } from "./auth/middleware.js";
import type { UserStore } from "./users/user.js";
import { mongoUserStore } from "./users/user.model.js";

type AppOptions = {
  dbReady?: () => boolean;
  users?: UserStore;
  jwtSecret?: string;
};

export function createApp({
  dbReady = () => mongoose.connection.readyState === 1,
  users = mongoUserStore,
  jwtSecret = process.env.JWT_SECRET ?? "",
}: AppOptions = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    const db = dbReady();
    res
      .status(db ? 200 : 503)
      .json({ status: db ? "ok" : "degraded", db: db ? "up" : "down" });
  });

  app.use("/api/auth", authRouter(users, jwtSecret));
  app.use(
    "/api/admin/employees",
    requireAuth(users, jwtSecret),
    requireRole("admin"),
    employeesRouter(users),
  );

  app.use(jsonErrors);

  return app;
}

// Keeps the { error } shape for malformed JSON and unexpected failures, without leaking details.
const jsonErrors: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const status = (err as { status?: number }).status ?? 500;
  if (status >= 400 && status < 500) {
    res.status(status).json({ error: "Invalid request" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
};
