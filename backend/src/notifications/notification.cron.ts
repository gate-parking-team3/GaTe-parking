import { timingSafeEqual } from "node:crypto";
import { Router } from "express";

type CronDeps = {
  /** CRON_SECRET. Without one the endpoint refuses every request. */
  secret: string | undefined;
  run: () => Promise<void>;
};

/** Vercel sends `Authorization: Bearer <CRON_SECRET>` with every scheduled run. */
function isAuthorized(header: string | undefined, secret: string | undefined) {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

/**
 * Mounted at /api/cron/notifications. Runs the notification check once; a
 * scheduled job calls it because a serverless function has no timer of its own.
 */
export function createNotificationCronRouter({ secret, run }: CronDeps) {
  const router = Router();
  router.get("/", async (req, res, next) => {
    if (!isAuthorized(req.header("authorization"), secret)) {
      res.status(401).json({ error: "Not allowed" });
      return;
    }
    try {
      await run();
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
