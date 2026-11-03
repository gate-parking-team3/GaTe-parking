import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { employeesRouter } from "./admin/employees.routes.js";
import { authRouter } from "./auth/auth.routes.js";
import { requireAuth, requireRole } from "./auth/middleware.js";
import {
  apiLimiter, DEFAULT_RATE_LIMITS, loginLimiter, type RateLimits,
} from "./auth/rate-limit.js";
import { activationRouter, registrationRouter, type FakeMailbox } from "./registration/registration.routes.js";
import type { UserStore } from "./users/user.js";
import { mongoUserStore } from "./users/user.model.js";

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
  const trustProxy = Number(process.env.TRUST_PROXY ?? 0);
  if (trustProxy > 0) app.set("trust proxy", trustProxy);
  app.use(cors());
  app.use(express.json());
  app.get("/api/health", (_req, res) => {
    const db = dbReady();
    res.status(db ? 200 : 503).json({ status: db ? "ok" : "degraded", db: db ? "up" : "down" });
  });

  const mailbox: FakeMailbox = new Map();
  app.post("/api/auth/login", loginLimiter(rateLimits.login));
  app.use(["/api/auth", "/api/admin", "/api/dev"], apiLimiter(rateLimits.api));
  app.use("/api/auth", authRouter(users, jwtSecret));
  app.use("/api/auth/activate", activationRouter(users));

  // All admin endpoints share the EXACT authentication middleware from PR #18.
  app.use("/api/admin/employees", requireAuth(users, jwtSecret), requireRole("admin"));
  app.use("/api/admin/employees", registrationRouter(users, mailbox));
  // Two-account policy: do not promote/demote the existing personal account in-place.
  app.patch("/api/admin/employees/:id", (req, res, next) => {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "role")) {
      res.status(400).json({ error: "Accounts have fixed roles; create a separate admin account" });
      return;
    }
    next();
  });
  app.use("/api/admin/employees", employeesRouter(users));

  if (process.env.NODE_ENV !== "production") {
    app.get("/api/dev/invitations/:email", requireAuth(users, jwtSecret), requireRole("admin"), (req, res) => {
      const invitation = mailbox.get(req.params.email.trim().toLowerCase());
      if (!invitation) {
        res.status(404).json({ error: "Invitation not found" });
        return;
      }
      res.json({
        activationUrl: `http://localhost:3000/activate?token=${invitation.token}`,
        expiresAt: invitation.expiresAt,
      });
    });
  }
  app.use(jsonErrors);
  return app;
}
const jsonErrors: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) { next(err); return; }
  const status = (err as { status?: number }).status ?? 500;
  if (status >= 400 && status < 500) {
    res.status(status).json({ error: "Invalid request" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
};
