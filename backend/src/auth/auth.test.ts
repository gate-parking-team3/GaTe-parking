import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { memoryUserStore } from "../users/memory-user-store.js";
import type { User } from "../users/user.js";
import { hashPassword } from "./password.js";
import { signToken } from "./token.js";

const SECRET = "test-secret";
let users: User[];

beforeAll(async () => {
  const passwordHash = await hashPassword("secret123");
  users = [
    {
      id: "u1",
      email: "petr@gate.cz",
      name: "Petr",
      passwordHash,
      role: "user",
      status: "active",
    },
    {
      id: "a1",
      email: "hynek@gate.cz",
      name: "Hynek",
      passwordHash,
      role: "admin",
      status: "active",
    },
    {
      id: "p1",
      email: "new@gate.cz",
      name: "New",
      passwordHash,
      role: "user",
      status: "pending",
    },
    {
      id: "d1",
      email: "gone@gate.cz",
      name: "Gone",
      passwordHash,
      role: "user",
      status: "disabled",
    },
  ];
});

const app = () =>
  createApp({ users: memoryUserStore(users), jwtSecret: SECRET });

describe("POST /api/auth/login", () => {
  it("returns a token and the user without the password hash", async () => {
    const res = await request(app())
      .post("/api/auth/login")
      .send({ email: " Petr@Gate.cz ", password: "secret123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: "u1",
      email: "petr@gate.cz",
      name: "Petr",
      role: "user",
      status: "active",
    });
  });

  it("rejects a wrong password and an unknown email the same way", async () => {
    const wrong = await request(app())
      .post("/api/auth/login")
      .send({ email: "petr@gate.cz", password: "nope" });
    const unknown = await request(app())
      .post("/api/auth/login")
      .send({ email: "nobody@gate.cz", password: "secret123" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("requires email and password", async () => {
    const res = await request(app())
      .post("/api/auth/login")
      .send({ email: "petr@gate.cz" });
    expect(res.status).toBe(400);
  });

  it("answers a malformed JSON body with a JSON 400", async () => {
    const res = await request(app())
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid request" });
  });

  it("hides storage failures behind a JSON 500", async () => {
    const failing = memoryUserStore();
    failing.findByEmail = () => Promise.reject(new Error("db down"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(createApp({ users: failing, jwtSecret: SECRET }))
      .post("/api/auth/login")
      .send({ email: "petr@gate.cz", password: "secret123" });
    errorLog.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Something went wrong" });
  });

  it.each([
    ["new@gate.cz", "Account is waiting for approval"],
    ["gone@gate.cz", "Account is disabled"],
  ])("refuses %s because the account is not active", async (email, error) => {
    const res = await request(app())
      .post("/api/auth/login")
      .send({ email, password: "secret123" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error });
  });
});

describe("GET /api/auth/me", () => {
  it("returns the signed-in user", async () => {
    const res = await request(app())
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${signToken("u1", SECRET)}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("petr@gate.cz");
  });

  it.each([
    ["no header", undefined],
    ["a malformed header", "Token abc"],
    ["a forged token", `Bearer ${signToken("u1", "other-secret")}`],
    [
      "a token signed with another algorithm",
      `Bearer ${jwt.sign({}, SECRET, { subject: "u1", algorithm: "HS512" })}`,
    ],
    ["an unknown user", `Bearer ${signToken("ghost", SECRET)}`],
    ["a disabled user", `Bearer ${signToken("d1", SECRET)}`],
  ])("returns 401 for %s", async (_label, header) => {
    const req = request(app()).get("/api/auth/me");
    const res = await (header ? req.set("Authorization", header) : req);
    expect(res.status).toBe(401);
  });
});

describe("rate limiting", () => {
  const limited = () =>
    createApp({
      users: memoryUserStore(users),
      jwtSecret: SECRET,
      rateLimits: { login: 2, api: 3 },
    });

  it("blocks login after too many failed attempts, not counting successes", async () => {
    const app = limited();
    const attempt = (password: string) =>
      request(app)
        .post("/api/auth/login")
        .send({ email: "petr@gate.cz", password });
    expect((await attempt("secret123")).status).toBe(200);
    expect((await attempt("nope")).status).toBe(401);
    expect((await attempt("nope")).status).toBe(401);
    const blocked = await attempt("secret123");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      error: "Too many login attempts, try again in 15 minutes",
    });
  });

  it("limits signed-in endpoints", async () => {
    const app = limited();
    const me = () =>
      request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${signToken("u1", SECRET)}`);
    for (let i = 0; i < 3; i++) expect((await me()).status).toBe(200);
    expect((await me()).status).toBe(429);
  });
});
