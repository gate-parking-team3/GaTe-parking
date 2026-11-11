import { afterEach, describe, expect, it, vi } from "vitest";
import { employeeApi } from "./employeeApi";
import { setToken } from "./client";

function mockFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("employeeApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setToken(null);
  });

  it("lists employees from /admin/employees", async () => {
    setToken("admin-jwt");
    const employees = [
      {
        id: "e1",
        name: "Eva Admin",
        email: "eva@gate.cz",
        role: "admin" as const,
        status: "active" as const,
      },
    ];
    const fetchMock = mockFetch(200, { employees });

    const res = await employeeApi.list();

    expect(res).toEqual({ employees });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/employees", {
      method: "GET",
      headers: { Authorization: "Bearer admin-jwt" },
      body: undefined,
    });
  });

  it("registers a new employee via POST /admin/employees", async () => {
    setToken("admin-jwt");
    const employee = {
      id: "e2",
      name: "Jana Nova",
      email: "jana@gate.cz",
      role: "user" as const,
      status: "pending" as const,
    };
    const fetchMock = mockFetch(201, { employee });

    const res = await employeeApi.register({
      name: "Jana Nova",
      email: "jana@gate.cz",
    });

    expect(res).toEqual({ employee });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/employees", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-jwt",
      },
      body: JSON.stringify({ name: "Jana Nova", email: "jana@gate.cz" }),
    });
  });

  it("fetches dev invitation for an email with proper path encoding", async () => {
    setToken("admin-jwt");
    const devData = {
      activationUrl: "http://localhost:3000/activate?token=123",
      expiresAt: "2026-11-12T12:00:00.000Z",
    };
    const fetchMock = mockFetch(200, devData);

    const res = await employeeApi.getDevInvitation("jana+dev@gate.cz");

    expect(res).toEqual(devData);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dev/invitations/jana%2Bdev%40gate.cz",
      {
        method: "GET",
        headers: { Authorization: "Bearer admin-jwt" },
        body: undefined,
      },
    );
  });
});
