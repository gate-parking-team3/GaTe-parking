import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { mongoNotificationStore, isNotificationType, type NotificationStore, type NotificationSettings } from "./notification.store.js";

const ID_PATTERN = /^[a-fA-F0-9]{24}$/;

/** Mount behind requireAuth(users, jwtSecret) at /api/notifications. */
export function createNotificationRouter(store: NotificationStore = mongoNotificationStore): Router {
  const router = Router();

  router.get("/", handle(async (req, res) => {
    if (!req.user) { res.status(401).json({ error: "Not signed in" }); return; }
    res.json(await store.list(req.user.id));
  }));

  router.get("/settings", handle(async (req, res) => {
    if (!req.user) { res.status(401).json({ error: "Not signed in" }); return; }
    res.json(await store.settings(req.user.id));
  }));

  router.patch("/settings", handle(async (req, res) => {
    if (!req.user) { res.status(401).json({ error: "Not signed in" }); return; }
    const body: unknown = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      res.status(400).json({ error: "Expected a settings object" }); return;
    }
    const entries = Object.entries(body);
    if (!entries.length || entries.some(([key, value]) => !isNotificationType(key) || typeof value !== "boolean")) {
      res.status(400).json({ error: "Settings must contain notification-type boolean fields" }); return;
    }
    res.json(await store.changeSettings(req.user.id, Object.fromEntries(entries) as Partial<NotificationSettings>));
  }));

  router.patch("/:id/read", handle(async (req, res) => {
    if (!req.user) { res.status(401).json({ error: "Not signed in" }); return; }
    const id = req.params.id;
    if (typeof id !== "string" || !ID_PATTERN.test(id)) {
      res.status(400).json({ error: "Invalid notification id" }); return;
    }
    if (!(await store.markRead(req.user.id, id, new Date()))) {
      res.status(404).json({ error: "Notification not found" }); return;
    }
    res.status(204).end();
  }));

  return router;
}

function handle(action: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next: NextFunction) => { action(req, res).catch(next); };
}
