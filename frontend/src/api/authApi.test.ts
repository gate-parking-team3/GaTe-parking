import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi } from "./authApi";
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

describe("authApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setToken(null);
  });

  it("posts credentials to /auth/login", async () => {
    const mockUser = {
      id: "u1",
      email: "petr@gate.cz",
      name: "Petr",
      role: "user" as const,
      status: "active" as const,
    };
    const fetchMock = mockFetch(200, {
      token: "jwt-token-123",
      user: mockUser,
    });

    const res = await authApi.login({
      email: "petr@gate.cz",
      password: "secret123",
    });

    expect(res).toEqual({ token: "jwt-token-123", user: mockUser });
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "petr@gate.cz", password: "secret123" }),
    });
  });

  it("fetches the current user from /auth/me with bearer token", async () => {
    setToken("my-jwt-token");
    const mockUser = {
      id: "u1",
      email: "petr@gate.cz",
      name: "Petr",
      role: "user" as const,
      status: "active" as const,
    };
    const fetchMock = mockFetch(200, { user: mockUser });

    const res = await authApi.me();

    expect(res).toEqual({ user: mockUser });
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", {
      method: "GET",
      headers: { Authorization: "Bearer my-jwt-token" },
      body: undefined,
    });
  });
});
