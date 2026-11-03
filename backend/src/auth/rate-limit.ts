import { rateLimit } from "express-rate-limit";

const WINDOW_MS = 15 * 60 * 1000;

export type RateLimits = {
  // Failed login attempts per IP per 15 minutes (successful logins do not count).
  login: number;
  // Requests per IP per 15 minutes to signed-in endpoints.
  api: number;
};

export const DEFAULT_RATE_LIMITS: RateLimits = { login: 10, api: 300 };

export function loginLimiter(limit: number) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many login attempts, try again in 15 minutes" },
  });
}

export function apiLimiter(limit: number) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests, slow down" },
  });
}
