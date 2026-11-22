import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { signToken } from "../auth/token.js";
import { memoryUserStore } from "../users/memory-user-store.js";
import type { User } from "../users/user.js";

const SECRET = "test-secret";

const seed = (): User[] => [
  {
    id: "a1",
    email: "hynek@gate.cz",
    name: "Hynek",
    passwordHash: "x",
    role: "admin",
    status: "active",
  },
  {
    id: "u1",
    email: "petr@gate.cz",
    name: "Petr",
    passwordHash: "x",
    role: "user",
    status: "active",
  },
  {
    id: "p1",
    email: "new@gate.cz",
    name: "New",
    passwordHash: "x",
    role: "user",
    status: "pending",
  },
];

function setup() {
  const app = createApp({ users: memoryUserStore(seed()), jwtSecret: SECRET });
  const as = (id: string) => `Bearer ${signToken(id, SECRET)}`;
  return { app, admin: as("a1"), user: as("u1") };
}

describe("admin employee endpoints", () => {
  it("lists employees without password hashes", async () => {
    const { app, admin } = setup();
    const res = await request(app)
      .get("/api/admin/employees")
      .set("Authorization", admin);
    expect(res.status).toBe(200);
    expect(res.body.employees).toHaveLength(3);
    expect(res.body.employees[0]).not.toHaveProperty("passwordHash");
  });

  it("refuses non-admins with 403 and anonymous callers with 401", async () => {
    const { app, user } = setup();
    expect(
      (
        await request(app)
          .get("/api/admin/employees")
          .set("Authorization", user)
      ).status,
    ).toBe(403);
    expect((await request(app).get("/api/admin/employees")).status).toBe(401);
  });

  it("gets one employee or 404", async () => {
    const { app, admin } = setup();
    const found = await request(app)
      .get("/api/admin/employees/u1")
      .set("Authorization", admin);
    expect(found.body.employee.email).toBe("petr@gate.cz");
    const missing = await request(app)
      .get("/api/admin/employees/zz")
      .set("Authorization", admin);
    expect(missing.status).toBe(404);
  });

  it("approves a pending employee and promotes them to admin", async () => {
    const { app, admin } = setup();
    const res = await request(app)
      .patch("/api/admin/employees/p1")
      .set("Authorization", admin)
      .send({ status: "active", role: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.employee).toMatchObject({
      status: "active",
      role: "admin",
    });
  });

  it("disabling an employee revokes their access immediately", async () => {
    const { app, admin, user } = setup();
    await request(app)
      .patch("/api/admin/employees/u1")
      .set("Authorization", admin)
      .send({ status: "disabled" });
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", user);
    expect(me.status).toBe(401);
  });

  it.each([
    [{}, "Nothing to change: send role and/or status"],
    [{ role: "owner" }, "role must be one of: user, admin"],
    [{ status: "gone" }, "status must be one of: pending, active, disabled"],
  ])("rejects invalid changes %j", async (body, error) => {
    const { app, admin } = setup();
    const res = await request(app)
      .patch("/api/admin/employees/u1")
      .set("Authorization", admin)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
  });

  it.each([[{ role: "user" }], [{ status: "disabled" }]])(
    "stops an admin from removing their own access %j",
    async (body) => {
      const { app, admin } = setup();
      const res = await request(app)
        .patch("/api/admin/employees/a1")
        .set("Authorization", admin)
        .send(body);
      expect(res.status).toBe(400);
    },
  );

  it("returns 404 when patching an unknown employee", async () => {
    const { app, admin } = setup();
    const res = await request(app)
      .patch("/api/admin/employees/zz")
      .set("Authorization", admin)
      .send({ status: "active" });
    expect(res.status).toBe(404);
  });
});
