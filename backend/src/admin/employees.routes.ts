import { Router } from "express";
import {
  ROLES,
  toPublicUser,
  USER_STATUSES,
  type UserChanges,
  type UserStore,
} from "../users/user.js";

// Mount behind requireAuth + requireRole("admin").
export function employeesRouter(users: UserStore): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const all = await users.list();
    res.json({ employees: all.map(toPublicUser) });
  });

  router.get("/:id", async (req, res) => {
    const user = await users.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    res.json({ employee: toPublicUser(user) });
  });

  // Change an employee's role and/or access status.
  router.patch("/:id", async (req, res) => {
    const { role, status } = (req.body ?? {}) as Record<string, unknown>;
    const changes: UserChanges = {};
    if (role !== undefined) {
      if (!ROLES.includes(role as never)) {
        res
          .status(400)
          .json({ error: `role must be one of: ${ROLES.join(", ")}` });
        return;
      }
      changes.role = role as UserChanges["role"];
    }
    if (status !== undefined) {
      if (!USER_STATUSES.includes(status as never)) {
        res.status(400).json({
          error: `status must be one of: ${USER_STATUSES.join(", ")}`,
        });
        return;
      }
      changes.status = status as UserChanges["status"];
    }
    if (Object.keys(changes).length === 0) {
      res
        .status(400)
        .json({ error: "Nothing to change: send role and/or status" });
      return;
    }
    const target = await users.findById(req.params.id);
    if (!target) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    // Stops an admin from locking themselves out (and possibly leaving no admin at all).
    // Compares stored ids, because one ObjectId can be written in several ways (e.g. upper case).
    if (
      target.id === req.user?.id &&
      (changes.role === "user" ||
        (changes.status && changes.status !== "active"))
    ) {
      res
        .status(400)
        .json({ error: "You cannot remove your own admin access" });
      return;
    }
    const updated = await users.update(target.id, changes);
    if (!updated) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    res.json({ employee: toPublicUser(updated) });
  });

  return router;
}
