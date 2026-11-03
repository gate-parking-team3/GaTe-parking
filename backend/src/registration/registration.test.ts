import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { verifyPassword } from "../auth/password.js";
import { signToken } from "../auth/token.js";
import { memoryUserStore } from "../users/memory-user-store.js";
import type { User } from "../users/user.js";

const SECRET = "tests-have-a-separate-jwt-secret";
function setup() {
  const original: User[] = [
    { id: "admin1", name: "Eva Prochazka", email: "eva.admin@gate.cz", passwordHash: "x", role: "admin", status: "active", employeeId: "E005" },
    { id: "employee1", name: "Eva Prochazka", email: "eva@gate.cz", passwordHash: "x", role: "user", status: "active", employeeId: "E005" },
  ];
  const users = memoryUserStore(original);
  const app = createApp({ users, jwtSecret: SECRET });
  const admin = `Bearer ${signToken("admin1", SECRET)}`;
  const employee = `Bearer ${signToken("employee1", SECRET)}`;
  return { app, users, admin, employee };
}
const post = { firstName: "Jana", lastName: "Nova", email: "JANA@GATE.CZ" };

describe("employee invitation registration", () => {
  it("requires the admin account, not the linked personal account", async () => {
    const { app, employee } = setup();
    expect((await request(app).post("/api/admin/employees").send(post)).status).toBe(401);
    expect((await request(app).post("/api/admin/employees").set("Authorization", employee).send(post)).status).toBe(403);
  });
  it("creates an independent pending user and activates once", async () => {
    const { app, users, admin } = setup();
    const created = await request(app).post("/api/admin/employees").set("Authorization", admin).send(post);
    expect(created.status).toBe(201);
    expect(created.body.employee).toMatchObject({ name: "Jana Nova", email: "jana@gate.cz", role: "user", status: "pending" });
    expect(created.body.employee.employeeId).toEqual(expect.any(String));
    expect(created.body.employee).not.toHaveProperty("passwordHash");
    expect(created.body.employee).not.toHaveProperty("activationTokenHash");
    const inbox = await request(app).get("/api/dev/invitations/jana@gate.cz").set("Authorization", admin);
    expect(inbox.status).toBe(200);
    const token = new URL(inbox.body.activationUrl).searchParams.get("token");
    expect(token).toMatch(/^[a-f\d]{64}$/);
    const first = await request(app).post("/api/auth/activate").send({ token, password: "supersecure12345" });
    expect(first.status).toBe(200);
    expect(first.body.user.status).toBe("active");
    expect((await request(app).post("/api/auth/activate").send({ token, password: "supersecure12345" })).status).toBe(400);
    const saved = await users.findByEmail("jana@gate.cz");
    expect(await verifyPassword("supersecure12345", saved!.passwordHash)).toBe(true);
    const login = await request(app).post("/api/auth/login").send({ email: "jana@gate.cz", password: "supersecure12345" });
    expect(login.status).toBe(200);
  });
  it("rejects duplicates and invalid input", async () => {
    const { app, admin } = setup();
    expect((await request(app).post("/api/admin/employees").set("Authorization", admin).send({ name: "Eva", email: "eva@gate.cz" })).status).toBe(409);
    expect((await request(app).post("/api/admin/employees").set("Authorization", admin).send({ name: "A", email: "bad" })).status).toBe(400);
  });
  it("protects fake mailbox and prevents changing an existing employee role", async () => {
    const { app, admin, employee } = setup();
    expect((await request(app).get("/api/dev/invitations/jana@gate.cz").set("Authorization", employee)).status).toBe(403);
    expect((await request(app).patch("/api/admin/employees/employee1").set("Authorization", admin).send({ role: "admin" })).status).toBe(400);
  });
  it("rejects invalid and weak activation submissions", async () => {
    const { app } = setup();
    expect((await request(app).post("/api/auth/activate").send({ token: "wrong", password: "securepassword123" })).status).toBe(400);
    expect((await request(app).post("/api/auth/activate").send({ token: "a".repeat(64), password: "tiny" })).status).toBe(400);
  });
});
