import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Role, User, UserStore } from "../users/user.js";
import { verifyToken } from "./token.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

// Loads the user on every request, so a disabled account or changed role takes effect immediately.
export function requireAuth(users: UserStore, secret: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    const userId =
      scheme === "Bearer" && token ? verifyToken(token, secret) : null;
    const user = userId ? await users.findById(userId) : null;
    if (!user || user.status !== "active") {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    req.user = user;
    next();
  };
}

export function requireRole(role: Role): RequestHandler {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      res.status(403).json({ error: "Not allowed" });
      return;
    }
    next();
  };
}
