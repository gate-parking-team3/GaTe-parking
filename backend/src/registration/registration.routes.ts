import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { hashPassword } from "../auth/password.js";
import { normalizeEmail, toPublicUser, type UserStore } from "../users/user.js";

const INVITATION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_PATTERN = /^[a-f\d]{64}$/;

export function hashInvitation(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Invitations "sent" in development, kept in server memory until real email exists.
export type FakeInvitation = { token: string; expiresAt: string };
export type FakeMailbox = Map<string, FakeInvitation>;

// Mount behind requireAuth + requireRole("admin"). Registers an employee and invites them.
export function registrationRouter(
  users: UserStore,
  mailbox: FakeMailbox,
): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : typeof body.firstName === "string" &&
            typeof body.lastName === "string"
          ? `${body.firstName.trim()} ${body.lastName.trim()}`.trim()
          : "";
    const email =
      typeof body.email === "string" ? normalizeEmail(body.email) : "";
    if (
      name.length < 2 ||
      name.length > 150 ||
      email.length > 254 ||
      !EMAIL_PATTERN.test(email)
    ) {
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
        email,
        name,
        // Nobody knows this password; the employee sets their own on activation.
        passwordHash: await hashPassword(randomBytes(32).toString("hex")),
        role: "user",
        status: "pending",
        activationTokenHash: hashInvitation(token),
        activationExpiresAt: expiresAt,
      });
      if (process.env.NODE_ENV !== "production") {
        mailbox.set(email, { token, expiresAt: expiresAt.toISOString() });
      }
      res.status(201).json({ employee: toPublicUser(employee) });
    } catch (error) {
      // Two parallel registrations of the same email: the unique index rejects one.
      if ((error as { code?: number }).code === 11000) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }
      throw error;
    }
  });

  return router;
}

// Public: the high-entropy invitation token is the credential.
export function activationRouter(users: UserStore): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const { token, password } = (req.body ?? {}) as Record<string, unknown>;
    // bcrypt ignores everything after 72 bytes, so longer passwords are refused.
    if (
      typeof token !== "string" ||
      !TOKEN_PATTERN.test(token) ||
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password) > 72
    ) {
      res.status(400).json({
        error: "Invalid token or password (8+ characters, max 72 bytes)",
      });
      return;
    }
    const user = await users.activateByToken(
      hashInvitation(token),
      await hashPassword(password),
      new Date(),
    );
    if (!user) {
      res
        .status(400)
        .json({ error: "Activation link is invalid, expired or already used" });
      return;
    }
    res.json({ user: toPublicUser(user) });
  });

  return router;
}

// Development only, behind requireAuth + requireRole("admin"): read an invitation link.
export function invitationInboxRouter(mailbox: FakeMailbox): Router {
  const router = Router();

  router.get("/:email", (req, res) => {
    const invitation = mailbox.get(normalizeEmail(req.params.email));
    if (!invitation) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }
    res.json({
      activationUrl: `http://localhost:3000/activate?token=${invitation.token}`,
      expiresAt: invitation.expiresAt,
    });
  });

  return router;
}
