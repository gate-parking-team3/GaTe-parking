import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Router } from "express";
import { hashPassword } from "../auth/password.js";
import { normalizeEmail, toPublicUser, type UserStore } from "../users/user.js";

const INVITATION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function hashInvitation(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// The fake mailbox lives in server memory, only exposed to a signed-in admin in development.
export type FakeInvitation = { token: string; expiresAt: string };
export type FakeMailbox = Map<string, FakeInvitation>;

export function registrationRouter(users: UserStore, mailbox: FakeMailbox): Router {
  const router = Router();
  router.post("/", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === "string"
      ? body.name.trim()
      : typeof body.firstName === "string" && typeof body.lastName === "string"
        ? `${body.firstName.trim()} ${body.lastName.trim()}`.trim()
        : "";
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    if (name.length < 2 || name.length > 150 || email.length > 254 || !EMAIL_PATTERN.test(email)) {
      res.status(400).json({ error: "Valid name and email are required" });
      return;
    }
    if (await users.findByEmail(email)) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);
    try {
      const employee = await users.create({
        email, name,
        employeeId: randomUUID(),
        passwordHash: await hashPassword(randomBytes(32).toString("hex")),
        role: "user", status: "pending",
        activationTokenHash: hashInvitation(token),
        activationExpiresAt: expiresAt,
      });
      if (process.env.NODE_ENV !== "production") {
        mailbox.set(email, { token, expiresAt: expiresAt.toISOString() });
      }
      res.status(201).json({ employee: toPublicUser(employee) });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }
      throw error;
    }
  });
  return router;
}

// No authentication needed: possession of a valid high-entropy invitation is the credential.
export function activationRouter(users: UserStore): Router {
  const router = Router();
  router.post("/", async (req, res) => {
    const { token, password } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof token !== "string" || !/^[a-f\d]{64}$/.test(token) ||
        typeof password !== "string" || password.length < 12 || Buffer.byteLength(password) > 72) {
      res.status(400).json({ error: "Invalid token or password (12+ characters, max 72 bytes)" });
      return;
    }
    const newHash = await hashPassword(password);
    const user = await users.activateByToken(hashInvitation(token), newHash, new Date());
    if (!user) {
      res.status(400).json({ error: "Activation link is invalid, expired or already used" });
      return;
    }
    res.json({ user: toPublicUser(user) });
  });
  return router;
}
