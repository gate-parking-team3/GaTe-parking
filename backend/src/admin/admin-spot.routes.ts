import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import type { AuditLogRecord, AuditLogStore } from "../audit/audit.types.js";
import type { UserStore } from "../users/user.js";
import { parseAuditQuery } from "./audit.query.js";
import { parseCreateSpot, parseLotQuery } from "./spot.input.js";
import { createSpotWithAudit, type SpotWriter } from "./spot.service.js";

export function createAdminSpotRouter(writer: SpotWriter): Router {
  const router = Router();
  router.get(
    "/",
    handle(async (req, res) => {
      const parsed = parseLotQuery(req.query);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }
      res
        .status(200)
        .json({ spots: await writer.spots.list(parsed.value.lotId) });
    }),
  );
  router.post(
    "/",
    handle(async (req, res) => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: "Not signed in" });
        return;
      }
      const parsed = parseCreateSpot(req.body);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }
      const created = await createSpotWithAudit(writer, parsed.value, user.id);
      if (!created.ok) {
        res.status(created.status).json({ error: created.error });
        return;
      }
      res.status(201).json({ spot: created.spot });
    }),
  );
  return router;
}

export function createAuditLogRouter(deps: {
  auditLogs: AuditLogStore;
  users: UserStore;
}): Router {
  const router = Router();
  router.get(
    "/",
    handle(async (req, res) => {
      const parsed = parseAuditQuery(req.query);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }
      const logs = await deps.auditLogs.list(parsed.value);
      res.status(200).json({ logs: await withUsers(logs, deps.users) });
    }),
  );
  return router;
}

async function withUsers(logs: AuditLogRecord[], users: UserStore) {
  const names = new Map<string, { name: string; email: string }>();
  for (const userId of new Set(logs.map((log) => log.userId))) {
    const user = await users.findById(userId);
    if (user) names.set(userId, { name: user.name, email: user.email });
  }
  return logs.map((log) => {
    const user = names.get(log.userId);
    return {
      id: log.id,
      user: {
        id: log.userId,
        name: user?.name ?? "",
        email: user?.email ?? "",
      },
      action: log.action,
      createdAt: log.createdAt.toISOString(),
    };
  });
}

function handle(
  action: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return (req, res, next: NextFunction) => {
    action(req, res).catch(next);
  };
}
