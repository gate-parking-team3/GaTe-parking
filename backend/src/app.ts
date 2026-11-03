import cors from "cors";
import express from "express";
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

  return app;
}
