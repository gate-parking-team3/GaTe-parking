import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { employeesRouter } from "./admin/employees.routes.js";
import { authRouter } from "./auth/auth.routes.js";
import { requireAuth, requireRole } from "./auth/middleware.js";
import {
  apiLimiter,
  DEFAULT_RATE_LIMITS,
  loginLimiter,
  type RateLimits,
} from "./auth/rate-limit.js";
import {
  activationRouter,
  invitationInboxRouter,
  registrationRouter,
  type FakeMailbox,
} from "./registration/registration.routes.js";
import type { UserStore } from "./users/user.js";
import {
  createLotRouter,
  createReservationRouter,
} from "./reservations/reservation.routes.js";
import { mongoUserStore } from "./users/user.model.js";
import { createVehicleRouter } from "./vehicles/vehicle.routes.js";
import { mongoVehicleUsage } from "./vehicles/vehicle.usage.js";

type AppOptions = {
  dbReady?: () => boolean;
  users?: UserStore;
  jwtSecret?: string;
  rateLimits?: RateLimits;
};

export function createApp({
  dbReady = () => mongoose.connection.readyState === 1,
  users = mongoUserStore,
  jwtSecret = process.env.JWT_SECRET ?? "",
  rateLimits = DEFAULT_RATE_LIMITS,
}: AppOptions = {}) {
  const app = express();
  // Behind a hosting proxy (Render) the real client IP is in X-Forwarded-For.
  // TRUST_PROXY is the number of proxies in front of the app; unset locally.
  const trustProxy = Number(process.env.TRUST_PROXY ?? 0);
  if (trustProxy > 0) app.set("trust proxy", trustProxy);
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    const db = dbReady();
    res
      .status(db ? 200 : 503)
      .json({ status: db ? "ok" : "degraded", db: db ? "up" : "down" });
  });

  // Development stand-in for sending invitation emails.
  const mailbox: FakeMailbox = new Map();

  app.post("/api/auth/login", loginLimiter(rateLimits.login));
  app.use(
    [
      "/api/auth",
      "/api/admin",
      "/api/vehicles",
      "/api/lots",
      "/api/reservations",
      "/api/dev",
    ],
    apiLimiter(rateLimits.api),
  );
  app.use("/api/auth/activate", activationRouter(users));
  app.use("/api/auth", authRouter(users, jwtSecret));
  app.use(
    "/api/admin/employees",
    requireAuth(users, jwtSecret),
    requireRole("admin"),
    registrationRouter(users, mailbox),
    employeesRouter(users),
  );
  if (process.env.NODE_ENV !== "production") {
    app.use(
      "/api/dev/invitations",
      requireAuth(users, jwtSecret),
      requireRole("admin"),
      invitationInboxRouter(mailbox),
    );
  }
  app.use(
    "/api/vehicles",
    requireAuth(users, jwtSecret),
    createVehicleRouter({ usage: mongoVehicleUsage(users) }),
  );
  app.use("/api/lots", requireAuth(users, jwtSecret), createLotRouter());
  app.use(
    "/api/reservations",
    requireAuth(users, jwtSecret),
    createReservationRouter(),
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
