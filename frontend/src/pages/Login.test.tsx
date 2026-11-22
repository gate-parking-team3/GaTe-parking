import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../api/authApi";
import { ApiError } from "../api/client";
import { AuthProvider } from "../context/AuthContext";
import type { User } from "../types/auth";
import Login, { getSafeReturnTo } from "./Login";

const mockUser: User = {
  id: "u1",
  email: "petr@gate.cz",
  name: "Petr Svoboda",
  role: "user",
  status: "active",
};

function renderLogin(
  initialEntries: (string | { pathname: string; state?: unknown })[] = [
    "/login",
  ],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="/" element={<h1>Home Page</h1>} />
          <Route
            path="reservations"
            element={<h1>Target Reservations Page</h1>}
          />
          <Route path="vehicles" element={<h1>Target Vehicles Page</h1>} />
          <Route path="history" element={<h1>Target History Page</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("getSafeReturnTo helper", () => {
  it("defaults to / for missing or null destinations", () => {
    expect(getSafeReturnTo(undefined)).toBe("/");
    expect(getSafeReturnTo(null)).toBe("/");
    expect(getSafeReturnTo("")).toBe("/");
  });

  it("preserves valid internal paths with query and hash from string", () => {
    expect(getSafeReturnTo("/vehicles?filter=all#top")).toBe(
      "/vehicles?filter=all#top",
    );
  });

  it("preserves valid internal paths with query and hash from Location object", () => {
    expect(
      getSafeReturnTo({
        pathname: "/reservations",
        search: "?date=today",
        hash: "#slot-1",
      }),
    ).toBe("/reservations?date=today#slot-1");
  });

  it("rejects protocol-relative URLs", () => {
    expect(getSafeReturnTo("//evil.com")).toBe("/");
    expect(getSafeReturnTo("//evil.com/phishing")).toBe("/");
  });

  it("rejects absolute URLs with protocol", () => {
    expect(getSafeReturnTo("https://evil.com")).toBe("/");
    expect(getSafeReturnTo("http://localhost:8080")).toBe("/");
    expect(getSafeReturnTo("javascript:alert(1)")).toBe("/");
  });

  it("rejects redirect loops back to /login", () => {
    expect(getSafeReturnTo("/login")).toBe("/");
    expect(getSafeReturnTo("/login?from=/vehicles")).toBe("/");
    expect(getSafeReturnTo("/login#section")).toBe("/");
  });
});

describe("Login page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders accessible email and password inputs and submit button", () => {
    renderLogin();

    expect(
      screen.getByRole("heading", { level: 1, name: "Sign In" }),
    ).toBeInTheDocument();

    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toHaveAttribute("type", "email");
    expect(emailInput).toHaveAttribute("autocomplete", "email");
    expect(emailInput).toBeRequired();

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
    expect(passwordInput).toBeRequired();

    const submitBtn = screen.getByRole("button", { name: "Sign in" });
    // Button should be disabled when fields are empty
    expect(submitBtn).toBeDisabled();
  });

  it("enables the submit button only when both fields have content", async () => {
    const user = userEvent.setup();
    renderLogin();

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitBtn = screen.getByRole("button", { name: "Sign in" });

    expect(submitBtn).toBeDisabled();

    await user.type(emailInput, "petr@gate.cz");
    expect(submitBtn).toBeDisabled();

    await user.type(passwordInput, "secret123");
    expect(submitBtn).toBeEnabled();

    // Clearing email disables it again
    await user.clear(emailInput);
    expect(submitBtn).toBeDisabled();
  });

  it("prevents duplicate submissions and shows loading state while submission is in flight", async () => {
    const user = userEvent.setup();
    let resolveLogin: (val: { token: string; user: User }) => void = () => {};
    const loginSpy = vi.spyOn(authApi, "login").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );

    renderLogin();

    await user.type(screen.getByLabelText("Email"), "petr@gate.cz");
    await user.type(screen.getByLabelText("Password"), "secret123");

    const submitBtn = screen.getByRole("button", { name: "Sign in" });
    await user.click(submitBtn);

    // Button should show loading text and be disabled
    const loadingBtn = screen.getByRole("button", { name: "Signing in…" });
    expect(loadingBtn).toBeInTheDocument();
    expect(loadingBtn).toBeDisabled();
    expect(loginSpy).toHaveBeenCalledTimes(1);

    // Attempt second submission via click and form submission while first is pending
    await user.click(loadingBtn);
    const form = loadingBtn.closest("form")!;
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );

    // Must still have been called exactly once
    expect(loginSpy).toHaveBeenCalledTimes(1);

    // Resolve login
    resolveLogin({ token: "jwt-token", user: mockUser });

    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });
  });

  it("does not alter or trim the password upon submission", async () => {
    const user = userEvent.setup();
    const loginSpy = vi.spyOn(authApi, "login").mockResolvedValue({
      token: "jwt-token",
      user: mockUser,
    });

    renderLogin();

    // Enter email with leading/trailing whitespace and password with spaces
    await user.type(screen.getByLabelText("Email"), "  petr@gate.cz  ");
    await user.type(screen.getByLabelText("Password"), "  secret space 123  ");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith({
        email: "petr@gate.cz",
        password: "  secret space 123  ",
      });
    });
  });

  it("redirects to home page by default after successful login", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockResolvedValue({
      token: "jwt-token",
      user: mockUser,
    });

    renderLogin();

    await user.type(screen.getByLabelText("Email"), "petr@gate.cz");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });
  });

  it("redirects back to intended protected route with query and hash after login", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockResolvedValue({
      token: "jwt-token",
      user: mockUser,
    });

    // Simulate arriving at /login with state.from
    renderLogin([
      {
        pathname: "/login",
        state: {
          from: {
            pathname: "/reservations",
            search: "?tab=upcoming",
            hash: "#res-42",
          },
        },
      },
    ]);

    await user.type(screen.getByLabelText("Email"), "petr@gate.cz");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Target Reservations Page")).toBeInTheDocument();
    });
  });

  it("rejects external redirect destinations and defaults to /", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockResolvedValue({
      token: "jwt-token",
      user: mockUser,
    });

    renderLogin([
      {
        pathname: "/login",
        state: { from: "https://evil.com/hack" },
      },
    ]);

    await user.type(screen.getByLabelText("Email"), "petr@gate.cz");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });
  });

  it("displays error message on invalid credentials (401)", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockRejectedValue(
      new ApiError("Wrong email or password", 401),
    );

    renderLogin();

    await user.type(screen.getByLabelText("Email"), "petr@gate.cz");
    await user.type(screen.getByLabelText("Password"), "wrongpass");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const errorAlert = await screen.findByRole("alert");
    expect(errorAlert).toHaveTextContent("Wrong email or password");
  });

  it("displays error message for pending account waiting for approval (403)", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockRejectedValue(
      new ApiError("Account is waiting for approval", 403),
    );

    renderLogin();

    await user.type(screen.getByLabelText("Email"), "new@gate.cz");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const errorAlert = await screen.findByRole("alert");
    expect(errorAlert).toHaveTextContent("Account is waiting for approval");
  });

  it("displays error message for disabled account (403)", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockRejectedValue(
      new ApiError("Account is disabled", 403),
    );

    renderLogin();

    await user.type(screen.getByLabelText("Email"), "gone@gate.cz");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const errorAlert = await screen.findByRole("alert");
    expect(errorAlert).toHaveTextContent("Account is disabled");
  });

  it("displays rate limiting message (429)", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockRejectedValue(
      new ApiError("Too many login attempts, try again in 15 minutes", 429),
    );

    renderLogin();

    await user.type(screen.getByLabelText("Email"), "petr@gate.cz");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const errorAlert = await screen.findByRole("alert");
    expect(errorAlert).toHaveTextContent(
      "Too many login attempts, try again in 15 minutes",
    );
  });

  it("displays network failure message (status 0)", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockRejectedValue(
      new ApiError("Cannot reach the server. Please try again.", 0),
    );

    renderLogin();

    await user.type(screen.getByLabelText("Email"), "petr@gate.cz");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const errorAlert = await screen.findByRole("alert");
    expect(errorAlert).toHaveTextContent(
      "Cannot reach the server. Please try again.",
    );
  });

  it("displays server error message on 500 failure", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockRejectedValue(
      new ApiError("Something went wrong", 500),
    );

    renderLogin();

    await user.type(screen.getByLabelText("Email"), "petr@gate.cz");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const errorAlert = await screen.findByRole("alert");
    expect(errorAlert).toHaveTextContent("Something went wrong");
  });

  it("clears error message when user modifies email or password input", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockRejectedValue(
      new ApiError("Wrong email or password", 401),
    );

    renderLogin();

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");

    await user.type(emailInput, "petr@gate.cz");
    await user.type(passwordInput, "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();

    // Modifying email clears error
    await user.type(emailInput, "a");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("displays generic error message on unexpected non-ApiError exceptions", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockRejectedValue(new Error("Unexpected crash"));

    renderLogin();

    await user.type(screen.getByLabelText("Email"), "petr@gate.cz");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const errorAlert = await screen.findByRole("alert");
    expect(errorAlert).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("validates required fields if form is submitted with empty values", async () => {
    renderLogin();
    const form = screen
      .getByRole("button", { name: "Sign in" })
      .closest("form")!;
    // Dispatch submit directly inside act
    await waitFor(() => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    const errorAlert = await screen.findByRole("alert");
    expect(errorAlert).toHaveTextContent("Email and password are required");
  });

  it("redirects an already authenticated user visiting /login without redirect loop", async () => {
    localStorage.setItem("gate-parking-token", "existing-token");
    vi.spyOn(authApi, "me").mockResolvedValue({ user: mockUser });

    renderLogin();

    // Automatically redirected to /
    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });
  });
});
