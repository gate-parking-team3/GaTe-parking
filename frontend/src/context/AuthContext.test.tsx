import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../api/authApi";
import { ApiError, apiClient, getToken, setToken } from "../api/client";
import type { User } from "../types/auth";
import { AuthProvider, useAuth } from "./AuthContext";

const mockActiveUser: User = {
  id: "u1",
  email: "petr@gate.cz",
  name: "Petr Svoboda",
  role: "user",
  status: "active",
};

const mockAdminUser: User = {
  id: "a1",
  email: "admin@gate.cz",
  name: "Eva Prochazka",
  role: "admin",
  status: "active",
};

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("throws an error if useAuth is used outside AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used inside <AuthProvider>",
    );
  });

  it("initializes as anonymous when no token is in storage", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.isRestoring).toBe(false);
    expect(result.current.restorationError).toBeNull();
  });

  it("restores a valid session when a stored token exists", async () => {
    setToken("valid-token");
    vi.spyOn(authApi, "me").mockResolvedValue({ user: mockActiveUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Initially restoring
    expect(result.current.isRestoring).toBe(true);

    await act(async () => {});

    expect(result.current.user).toEqual(mockActiveUser);
    expect(result.current.isRestoring).toBe(false);
    expect(result.current.restorationError).toBeNull();
    expect(getToken()).toBe("valid-token");
  });

  it("clears stored token and user when session restoration returns 401 (expired/invalid)", async () => {
    setToken("expired-token");
    vi.spyOn(authApi, "me").mockRejectedValue(
      new ApiError("Not signed in", 401),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {});

    expect(result.current.user).toBeNull();
    expect(result.current.isRestoring).toBe(false);
    expect(result.current.restorationError).toBeNull();
    expect(getToken()).toBeNull();
  });

  it("clears token and completes restoration when /api/auth/me returns 401 via fetch boundary", async () => {
    setToken("invalid-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {});

    expect(getToken()).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isRestoring).toBe(false);
  });

  it("completes restoration and clears auth when retryRestoration receives 401 via fetch boundary", async () => {
    setToken("test-token");
    // 1. Initial attempt fails with recoverable network error
    let fetchMock = vi.fn().mockRejectedValue(new TypeError("Network error"));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    expect(getToken()).toBe("test-token");
    expect(result.current.isRestoring).toBe(false);
    expect(result.current.restorationError).toBeTruthy();

    // 2. Retry receives 401 from server
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      await result.current.retryRestoration();
    });

    expect(getToken()).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isRestoring).toBe(false);
    expect(result.current.restorationError).toBeNull();
  });

  it("preserves stored token and exposes recoverable error on network/server failure during restoration", async () => {
    setToken("valid-token");
    vi.spyOn(authApi, "me").mockRejectedValue(
      new ApiError("Cannot reach the server. Please try again.", 0),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {});

    // Token is NOT deleted on recoverable error
    expect(getToken()).toBe("valid-token");
    expect(result.current.user).toBeNull();
    expect(result.current.isRestoring).toBe(false);
    expect(result.current.restorationError).toBe(
      "Cannot reach the server. Please try again.",
    );

    // Retrying restoration succeeds once network recovers
    vi.spyOn(authApi, "me").mockResolvedValue({ user: mockActiveUser });

    await act(async () => {
      await result.current.retryRestoration();
    });

    expect(result.current.user).toEqual(mockActiveUser);
    expect(result.current.restorationError).toBeNull();
  });

  it("handles retryRestoration when token is absent or when retry returns 401", async () => {
    // 1. When token is absent
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.retryRestoration();
    });
    expect(result.current.user).toBeNull();
    expect(result.current.isRestoring).toBe(false);

    // 2. When retry returns 401
    setToken("bad-token");
    vi.spyOn(authApi, "me").mockRejectedValue(
      new ApiError("Not signed in", 401),
    );
    await act(async () => {
      await result.current.retryRestoration();
    });
    expect(getToken()).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it("does not restore user if logout was called while restoration was in flight", async () => {
    setToken("old-token");
    let resolveMe: (val: { user: User }) => void = () => {};
    vi.spyOn(authApi, "me").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMe = resolve;
        }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    // User logs out while me() is still in flight
    act(() => {
      result.current.logout();
    });

    expect(getToken()).toBeNull();
    expect(result.current.user).toBeNull();

    // Now me() resolves with the old user
    await act(async () => {
      resolveMe({ user: mockActiveUser });
    });

    // The stale restoration response must be ignored
    expect(result.current.user).toBeNull();
    expect(getToken()).toBeNull();
  });

  it("does not overwrite a newer login if restoration finishes late", async () => {
    setToken("token-1");
    let resolveMe: (val: { user: User }) => void = () => {};
    vi.spyOn(authApi, "me").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMe = resolve;
        }),
    );
    vi.spyOn(authApi, "login").mockResolvedValue({
      token: "token-2",
      user: mockAdminUser,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // User logs in as admin while restoration of token-1 is pending
    await act(async () => {
      await result.current.login("admin@gate.cz", "pw");
    });

    expect(result.current.user).toEqual(mockAdminUser);
    expect(getToken()).toBe("token-2");

    // Late restoration of token-1 resolves
    await act(async () => {
      resolveMe({ user: mockActiveUser });
    });

    // Must remain the newly logged in admin
    expect(result.current.user).toEqual(mockAdminUser);
    expect(getToken()).toBe("token-2");
  });

  it("logs in successfully, updating user and token", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({
      token: "new-token",
      user: mockActiveUser,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    let loggedIn: User | undefined;
    await act(async () => {
      loggedIn = await result.current.login("petr@gate.cz", "secret");
    });

    expect(loggedIn).toEqual(mockActiveUser);
    expect(result.current.user).toEqual(mockActiveUser);
    expect(getToken()).toBe("new-token");
  });

  it("logs out, clearing user and token", () => {
    setToken("active-token");
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(getToken()).toBeNull();
  });

  it("invalidates the session when a protected API request returns 401", async () => {
    setToken("active-token");
    vi.spyOn(authApi, "me").mockResolvedValue({ user: mockActiveUser });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    expect(result.current.user).toEqual(mockActiveUser);

    // Simulate an authenticated request to a protected endpoint returning 401
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      await expect(apiClient.get("/vehicles")).rejects.toThrow();
    });

    // Session is invalidated immediately without page reload
    expect(result.current.user).toBeNull();
    expect(getToken()).toBeNull();
  });

  it("does not invalidate session if a 401 response belongs to an old token", async () => {
    setToken("new-token");
    vi.spyOn(authApi, "me").mockResolvedValue({ user: mockActiveUser });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    expect(result.current.user).toEqual(mockActiveUser);

    // A late 401 response from an older token (e.g. "old-token") arrives
    // We simulate this by checking that if the sent token was different, it does not clear
    const fetchMock = vi.fn().mockImplementation(() => {
      // simulate race condition where token was changed before response arrived
      setToken("brand-new-token");
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not signed in" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      await expect(apiClient.get("/vehicles")).rejects.toThrow();
    });

    // Because the token sent was "new-token" but storage now has "brand-new-token",
    // the current session and in-memory user are NOT invalidated!
    expect(getToken()).toBe("brand-new-token");
    expect(result.current.user).toEqual(mockActiveUser);
  });

  it("does not invalidate session on 403 forbidden response", async () => {
    setToken("active-token");
    vi.spyOn(authApi, "me").mockResolvedValue({ user: mockActiveUser });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    expect(result.current.user).toEqual(mockActiveUser);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Not allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      await expect(apiClient.get("/admin/employees")).rejects.toThrow();
    });

    // User is still authenticated!
    expect(result.current.user).toEqual(mockActiveUser);
    expect(getToken()).toBe("active-token");
  });
});
