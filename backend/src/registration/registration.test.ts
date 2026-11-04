import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { verifyPassword } from "../auth/password.js";
import { signToken } from "../auth/token.js";
import { memoryUserStore } from "../users/memory-user-store.js";
import type { User } from "../users/user.js";
import { hashInvitation } from "./registration.routes.js";

const SECRET = "tests-have-a-separate-jwt-secret";
const PASSWORD = "supersecure12345";
const newEmployee = {
  firstName: "Jana",
  lastName: "Nova",
  email: "JANA@GATE.CZ",
};

function setup(extra: User[] = []) {
  const users = memoryUserStore([
    {
      id: "admin1",
      name: "Eva Admin",
      email: "admin@gate.cz",
      passwordHash: "x",
      role: "admin",
      status: "active",
    },
    {
      id: "employee1",
      name: "Petr Novak",
      email: "petr@gate.cz",
      passwordHash: "x",
      role: "user",
      status: "active",
    },
    ...extra,
  ]);
  const app = createApp({ users, jwtSecret: SECRET });
  const admin = `Bearer ${signToken("admin1", SECRET)}`;
  const employee = `Bearer ${signToken("employee1", SECRET)}`;
  return { app, users, admin, employee };
}

async function invitationToken(
  app: ReturnType<typeof createApp>,
  admin: string,
  email: string,
) {
  const inbox = await request(app)
    .get(`/api/dev/invitations/${email}`)
    .set("Authorization", admin);
  expect(inbox.status).toBe(200);
  return new URL(inbox.body.activationUrl).searchParams.get("token");
}

describe("employee registration", () => {
  it("is only allowed for admins", async () => {
    const { app, employee } = setup();
    const anonymous = await request(app)
      .post("/api/admin/employees")
      .send(newEmployee);
    expect(anonymous.status).toBe(401);
    const user = await request(app)
      .post("/api/admin/employees")
      .set("Authorization", employee)
      .send(newEmployee);
    expect(user.status).toBe(403);
  });

  it("creates a pending employee without leaking secrets", async () => {
    const { app, admin } = setup();
    const created = await request(app)
      .post("/api/admin/employees")
      .set("Authorization", admin)
      .send(newEmployee);
    expect(created.status).toBe(201);
    expect(created.body.employee).toEqual({
      id: expect.any(String),
      name: "Jana Nova",
      email: "jana@gate.cz",
      role: "user",
      status: "pending",
    });
    const list = await request(app)
      .get("/api/admin/employees")
      .set("Authorization", admin);
    for (const listed of list.body.employees) {
      expect(listed).not.toHaveProperty("passwordHash");
      expect(listed).not.toHaveProperty("activationTokenHash");
    }
  });

  it("rejects duplicates and invalid input", async () => {
    const { app, admin } = setup();
    const duplicate = await request(app)
      .post("/api/admin/employees")
      .set("Authorization", admin)
      .send({ name: "Petr", email: "PETR@gate.cz" });
    expect(duplicate.status).toBe(409);
    const invalid = await request(app)
      .post("/api/admin/employees")
      .set("Authorization", admin)
      .send({ name: "A", email: "bad" });
    expect(invalid.status).toBe(400);
  });

  it("keeps the development inbox admin-only", async () => {
    const { app, employee } = setup();
    const res = await request(app)
      .get("/api/dev/invitations/jana@gate.cz")
      .set("Authorization", employee);
    expect(res.status).toBe(403);
  });
});

describe("access activation", () => {
  it("activates once with the invitation and allows login", async () => {
    const { app, users, admin } = setup();
    await request(app)
      .post("/api/admin/employees")
      .set("Authorization", admin)
      .send(newEmployee);
    const token = await invitationToken(app, admin, "jana@gate.cz");
    expect(token).toMatch(/^[a-f\d]{64}$/);

    const first = await request(app)
      .post("/api/auth/activate")
      .send({ token, password: PASSWORD });
    expect(first.status).toBe(200);
    expect(first.body.user.status).toBe("active");
    const again = await request(app)
      .post("/api/auth/activate")
      .send({ token, password: PASSWORD });
    expect(again.status).toBe(400);

    const saved = await users.findByEmail("jana@gate.cz");
    expect(await verifyPassword(PASSWORD, saved!.passwordHash)).toBe(true);
    expect(saved).not.toHaveProperty("activationTokenHash");
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "jana@gate.cz", password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it("rejects an expired invitation", async () => {
    const token = "b".repeat(64);
    const { app } = setup([
      {
        id: "expired1",
        name: "Old Invite",
        email: "old@gate.cz",
        passwordHash: "x",
        role: "user",
        status: "pending",
        activationTokenHash: hashInvitation(token),
        activationExpiresAt: new Date(Date.now() - 1000),
      },
    ]);
    const res = await request(app)
      .post("/api/auth/activate")
      .send({ token, password: PASSWORD });
    expect(res.status).toBe(400);
  });

  it("rejects malformed tokens and weak passwords", async () => {
    const { app } = setup();
    const badToken = await request(app)
      .post("/api/auth/activate")
      .send({ token: "wrong", password: PASSWORD });
    expect(badToken.status).toBe(400);
    const weak = await request(app)
      .post("/api/auth/activate")
      .send({ token: "a".repeat(64), password: "tiny" });
    expect(weak.status).toBe(400);
  });
});
