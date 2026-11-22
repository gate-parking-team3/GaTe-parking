import type { NextFunction, Request, Response } from "express";

/**
 * Ownership comes only from `req.user.id`.
 * `requireAuth` (auth/middleware) sets `req.user`.
 */
export function requireVehicleOwner(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = req.user?.id;

  if (typeof id !== "string" || id.length === 0) {
    res.status(401).json({ error: "Authentication is required" });
    return;
  }

  res.locals.ownerId = id;
  next();
}

export function readOwnerId(res: Response): string | null {
  const id = res.locals.ownerId;
  return typeof id === "string" && id.length > 0 ? id : null;
}
