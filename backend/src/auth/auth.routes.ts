import { Router } from "express";
import { toPublicUser, type UserStore } from "../users/user.js";
import { requireAuth } from "./middleware.js";
import { DUMMY_HASH, verifyPassword } from "./password.js";
import { signToken } from "./token.js";

export function authRouter(users: UserStore, secret: string): Router {
  const router = Router();

  router.post("/login", async (req, res) => {
    const { email, password } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const user = await users.findByEmail(email);
    const valid = await verifyPassword(
      password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !valid) {
      res.status(401).json({ error: "Wrong email or password" });
      return;
    }
    if (user.status !== "active") {
      res.status(403).json({
        error:
          user.status === "pending"
            ? "Account is waiting for approval"
            : "Account is disabled",
      });
      return;
    }
    res.json({ token: signToken(user.id, secret), user: toPublicUser(user) });
  });

  router.get("/me", requireAuth(users, secret), (req, res) => {
    res.json({ user: toPublicUser(req.user!) });
  });

  return router;
}
