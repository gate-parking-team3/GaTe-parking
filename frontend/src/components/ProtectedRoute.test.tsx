import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../api/authApi";
import { ApiError, getToken, setToken } from "../api/client";
import { AuthProvider } from "../context/AuthContext";
import type { User } from "../types/auth";
import ProtectedRoute from "./ProtectedRoute";

const mockUser: User = {
  id: "u1",
  email: "petr@gate.cz",
  name: "Petr",
  role: "user",
  status: "active",
};

function TestLoginTarget() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from;
  return (
    <div>
      <h1>Login Page</h1>
      <p data-testid="redirected-from">{from?.pathname ?? "none"}</p>
    </div>
  );
}

function renderProtected(initialPath = "/protected") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="login" element={<TestLoginTarget />} />
          <Route element={<ProtectedRoute />}>
            <Route path="protected" element={<h1>Protected Secret Area</h1>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders loading indicator while session is restoring", () => {
    setToken("valid-token");
    // Return pending promise
    vi.spyOn(authApi, "me").mockImplementation(() => new Promise(() => {}));

    renderProtected();

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByText("Protected Secret Area")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated user to /login with original location in state.from", async () => {
    renderProtected("/protected");

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
    expect(screen.getByTestId("redirected-from")).toHaveTextContent(
      "/protected",
    );
    expect(screen.queryByText("Protected Secret Area")).not.toBeInTheDocument();
  });

  it("renders protected content when user is authenticated", async () => {
    setToken("valid-token");
    vi.spyOn(authApi, "me").mockResolvedValue({ user: mockUser });

    renderProtected("/protected");

    expect(
      await screen.findByText("Protected Secret Area"),
    ).toBeInTheDocument();
  });

  it("displays recoverable error and retry button on restoration network/server error", async () => {
    const user = userEvent.setup();
    setToken("valid-token");
    const meSpy = vi
      .spyOn(authApi, "me")
      .mockRejectedValue(
        new ApiError("Cannot reach the server. Please try again.", 0),
      );

    renderProtected("/protected");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Cannot reach the server. Please try again.",
    );

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    expect(retryBtn).toBeInTheDocument();

    // Now server comes back up
    meSpy.mockResolvedValue({ user: mockUser });

    await user.click(retryBtn);

    expect(
      await screen.findByText("Protected Secret Area"),
    ).toBeInTheDocument();
  });

  it("redirects to /login when stored token returns 401 via fetch boundary", async () => {
    setToken("expired-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderProtected("/protected");

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });

  it("completes restoration and redirects to /login under React StrictMode when token returns 401", async () => {
    setToken("expired-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <StrictMode>
        <MemoryRouter initialEntries={["/protected"]}>
          <AuthProvider>
            <Routes>
              <Route path="login" element={<TestLoginTarget />} />
              <Route element={<ProtectedRoute />}>
                <Route
                  path="protected"
                  element={<h1>Protected Secret Area</h1>}
                />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </StrictMode>,
    );

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });

  describe("Role-based access", () => {
    it("renders Access Denied when signed-in user does not have requiredRole", async () => {
      setToken("valid-token");
      vi.spyOn(authApi, "me").mockResolvedValue({
        user: { ...mockUser, role: "user" },
      });

      render(
        <MemoryRouter initialEntries={["/admin/employees"]}>
          <AuthProvider>
            <Routes>
              <Route path="login" element={<TestLoginTarget />} />
              <Route element={<ProtectedRoute requiredRole="admin" />}>
                <Route
                  path="admin/employees"
                  element={<h1>Admin Secret Panel</h1>}
                />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>,
      );

      expect(
        await screen.findByRole("heading", { name: "Access Denied" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("You do not have permission to access this page."),
      ).toBeInTheDocument();
      expect(screen.queryByText("Admin Secret Panel")).not.toBeInTheDocument();
      // Crucial: User is NOT logged out
      expect(getToken()).toBe("valid-token");
    });

    it("renders protected child content when signed-in user has requiredRole", async () => {
      setToken("valid-token");
      vi.spyOn(authApi, "me").mockResolvedValue({
        user: { ...mockUser, role: "admin" },
      });

      render(
        <MemoryRouter initialEntries={["/admin/employees"]}>
          <AuthProvider>
            <Routes>
              <Route path="login" element={<TestLoginTarget />} />
              <Route element={<ProtectedRoute requiredRole="admin" />}>
                <Route
                  path="admin/employees"
                  element={<h1>Admin Secret Panel</h1>}
                />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>,
      );

      expect(await screen.findByText("Admin Secret Panel")).toBeInTheDocument();
    });
  });
});
