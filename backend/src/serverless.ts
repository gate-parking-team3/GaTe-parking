import express, { type Express } from "express";

/**
 * Wraps the API for a serverless host (Vercel), where nothing runs at startup.
 * The database connects on the first request and is reused while the instance
 * stays warm. A failed attempt is not cached, so the next request tries again.
 * While the database is down /api/health still answers (as "degraded") and
 * every other route returns 503 instead of waiting on a dead connection.
 */
export function withLazyDb(
  api: Express,
  connect: () => Promise<void>,
): Express {
  let pending: Promise<void> | null = null;
  const app = express();

  app.use(async (req, res, next) => {
    pending ??= connect().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    try {
      await pending;
      next();
    } catch (error) {
      console.error("Database connection failed", error);
      if (req.path === "/api/health") {
        next();
        return;
      }
      res.status(503).json({ error: "Database unavailable" });
    }
  });

  app.use(api);
  return app;
}
