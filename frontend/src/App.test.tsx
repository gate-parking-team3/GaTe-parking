import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "./api/authApi";
import { vehicleApi } from "./api/vehicleApi";
import App from "./App";
import type { User } from "./types/auth";

const mockUser: User = {
  id: "u1",
  email: "petr@gate.cz",
  name: "Petr Svoboda",
  role: "user",
  status: "active",
};

function renderApp(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Anonymous user experience", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the site name and a Sign in link in the header", () => {
    renderApp("/login");
    const header = screen.getByRole("banner");
    expect(within(header).getByText("GaŤe Parking")).toBeInTheDocument();
    expect(
      within(header).getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/login");
  });

  it("does not render the main navigation when not signed in", () => {
    renderApp("/login");
    expect(
      screen.queryByRole("navigation", { name: "Main" }),
    ).not.toBeInTheDocument();
  });

  it("redirects anonymous visitor from / to /login", async () => {
    renderApp("/");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Sign In" }),
    ).toBeInTheDocument();
  });

  it("redirects anonymous visitor from /reservations to /login", async () => {
    renderApp("/reservations");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Sign In" }),
    ).toBeInTheDocument();
  });

  it("redirects anonymous visitor from /vehicles to /login", async () => {
    renderApp("/vehicles");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Sign In" }),
    ).toBeInTheDocument();
  });

  it("redirects anonymous visitor from /history to /login", async () => {
    renderApp("/history");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Sign In" }),
    ).toBeInTheDocument();
  });

  it("redirects anonymous visitor from /admin/employees to /login", async () => {
    renderApp("/admin/employees");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Sign In" }),
    ).toBeInTheDocument();
  });

  it("allows anonymous visitor to open /activate without redirecting to /login", () => {
    renderApp("/activate");
    expect(
      screen.getByRole("heading", { level: 1, name: "Account Activation" }),
    ).toBeInTheDocument();
  });

  it("shows login page when initial session restoration returns 401 via fetch boundary", async () => {
    localStorage.setItem("gate-parking-token", "expired-user-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/reservations");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Sign In" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("gate-parking-token")).toBeNull();
  });

  it("shows the not-found page for unknown routes", () => {
    renderApp("/this-does-not-exist");
    expect(
      screen.getByRole("heading", { level: 1, name: "Page Not Found" }),
    ).toBeInTheDocument();
  });

  it("has a link back to the home page on not-found", () => {
    renderApp("/unknown");
    const link = screen.getByRole("link", { name: "Go to the home page" });
    expect(link).toHaveAttribute("href", "/");
  });

  it("navigates from not-found back to the home page (redirecting to /login when anonymous)", async () => {
    const user = userEvent.setup();
    renderApp("/unknown");
    await user.click(screen.getByRole("link", { name: "Go to the home page" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Sign In" }),
    ).toBeInTheDocument();
  });
});

describe("Authenticated user experience", () => {
  beforeEach(() => {
    localStorage.setItem("gate-parking-token", "valid-user-token");
    vi.spyOn(authApi, "me").mockResolvedValue({ user: mockUser });
    vi.spyOn(vehicleApi, "list").mockResolvedValue([]);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the user name and a Sign out button in the header", async () => {
    renderApp("/");
    expect(await screen.findByText("Petr Svoboda")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("renders the main navigation with all links", async () => {
    renderApp("/");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Parking" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      within(nav).getByRole("link", { name: "Reservations" }),
    ).toHaveAttribute("href", "/reservations");
    expect(within(nav).getByRole("link", { name: "Vehicles" })).toHaveAttribute(
      "href",
      "/vehicles",
    );
    expect(within(nav).getByRole("link", { name: "History" })).toHaveAttribute(
      "href",
      "/history",
    );
    expect(
      within(nav).queryByRole("link", { name: "Employees" }),
    ).not.toBeInTheDocument();
  });

  it("shows Access Denied and does not fetch employees when regular user visits /admin/employees", async () => {
    const listSpy = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/admin/employees")) {
          listSpy();
        }
        return Promise.resolve(new Response(JSON.stringify({})));
      }),
    );

    renderApp("/admin/employees");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Access Denied" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You do not have permission to access this page."),
    ).toBeInTheDocument();
    expect(listSpy).not.toHaveBeenCalled();
  });

  it("renders Employees link and allows access for administrator", async () => {
    const adminUser: User = { ...mockUser, role: "admin", name: "Eva Admin" };
    vi.spyOn(authApi, "me").mockResolvedValue({ user: adminUser });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ employees: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/admin/employees");

    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(
      within(nav).getByRole("link", { name: "Employees" }),
    ).toHaveAttribute("href", "/admin/employees");
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Employee Management",
      }),
    ).toBeInTheDocument();
  });

  it("renders the parking availability page at /", async () => {
    renderApp("/");
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Parking Availability",
      }),
    ).toBeInTheDocument();
  });

  it("navigates to the reservations page via link click", async () => {
    const user = userEvent.setup();
    renderApp("/");
    const nav = await screen.findByRole("navigation", { name: "Main" });
    await user.click(within(nav).getByRole("link", { name: "Reservations" }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "My Reservations",
      }),
    ).toBeInTheDocument();
  });

  it("renders direct routes: /vehicles and /history", async () => {
    const { unmount } = renderApp("/vehicles");
    expect(
      await screen.findByRole("heading", { level: 1, name: "My Vehicles" }),
    ).toBeInTheDocument();
    unmount();

    renderApp("/history");
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Parking History",
      }),
    ).toBeInTheDocument();
  });

  it("marks active navigation states", async () => {
    const { unmount } = renderApp("/");
    const parkingLink = await screen.findByRole("link", { name: "Parking" });
    expect(parkingLink).toHaveClass("main-nav__link--active");
    unmount();

    renderApp("/reservations");
    const resLink = await screen.findByRole("link", { name: "Reservations" });
    expect(resLink).toHaveClass("main-nav__link--active");
    expect(screen.getByRole("link", { name: "Parking" })).not.toHaveClass(
      "main-nav__link--active",
    );
  });

  it("logs out on Sign out button click, hiding nav and removing protected access", async () => {
    const user = userEvent.setup();
    renderApp("/");

    const logoutBtn = await screen.findByRole("button", { name: "Sign out" });
    await user.click(logoutBtn);

    // Nav is gone, sign-in link is shown
    expect(
      screen.queryByRole("navigation", { name: "Main" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();

    // Trying to visit /reservations redirects to /login
    expect(
      await screen.findByRole("heading", { level: 1, name: "Sign In" }),
    ).toBeInTheDocument();
  });

  it("navigates from not-found back to the home page when authenticated", async () => {
    const user = userEvent.setup();
    renderApp("/unknown");

    const link = await screen.findByRole("link", {
      name: "Go to the home page",
    });
    await user.click(link);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Parking Availability",
      }),
    ).toBeInTheDocument();
  });
});

describe("Full login and redirect integration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("logs in from redirected location and returns to original route", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockResolvedValue({
      token: "new-jwt-token",
      user: mockUser,
    });
    vi.spyOn(authApi, "me").mockResolvedValue({ user: mockUser });

    // Anonymous user attempts to visit /reservations directly
    renderApp("/reservations");

    // Land on login page
    expect(
      await screen.findByRole("heading", { level: 1, name: "Sign In" }),
    ).toBeInTheDocument();

    // Fill form and submit
    await user.type(screen.getByLabelText("Email"), "petr@gate.cz");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    // Land on the original protected target: /reservations
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "My Reservations",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Petr Svoboda")).toBeInTheDocument();
  });
});
