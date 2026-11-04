import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import App from "./App";

function renderApp(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Shared layout", () => {
  it("renders the site name in the header", () => {
    renderApp();
    const header = screen.getByRole("banner");
    expect(within(header).getByText("GaŤe Parking")).toBeInTheDocument();
  });

  it("renders the main navigation with all links", () => {
    renderApp();
    const nav = screen.getByRole("navigation", { name: "Main" });
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
  });
});

describe("Default page", () => {
  it("renders the parking availability placeholder at /", () => {
    renderApp("/");
    expect(
      screen.getByRole("heading", { level: 1, name: "Parking Availability" }),
    ).toBeInTheDocument();
  });
});

describe("Navigation", () => {
  it("navigates to the reservations page via link click", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await user.click(screen.getByRole("link", { name: "Reservations" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "My Reservations" }),
    ).toBeInTheDocument();
  });
});

describe("Direct route rendering", () => {
  it("renders the vehicles page at /vehicles", () => {
    renderApp("/vehicles");
    expect(
      screen.getByRole("heading", { level: 1, name: "My Vehicles" }),
    ).toBeInTheDocument();
  });

  it("renders the history page at /history", () => {
    renderApp("/history");
    expect(
      screen.getByRole("heading", { level: 1, name: "Parking History" }),
    ).toBeInTheDocument();
  });
});

describe("Active navigation state", () => {
  it("marks the Parking link as active on the home page", () => {
    renderApp("/");
    const link = screen.getByRole("link", { name: "Parking" });
    expect(link).toHaveClass("main-nav__link--active");
  });

  it("marks the Reservations link as active on /reservations", () => {
    renderApp("/reservations");
    const link = screen.getByRole("link", { name: "Reservations" });
    expect(link).toHaveClass("main-nav__link--active");
  });

  it("does not mark the Parking link as active on /reservations", () => {
    renderApp("/reservations");
    const link = screen.getByRole("link", { name: "Parking" });
    expect(link).not.toHaveClass("main-nav__link--active");
  });
});

describe("Not-found page", () => {
  it("shows the not-found page for unknown routes", () => {
    renderApp("/this-does-not-exist");
    expect(
      screen.getByRole("heading", { level: 1, name: "Page Not Found" }),
    ).toBeInTheDocument();
  });

  it("has a link back to the home page", () => {
    renderApp("/unknown");
    const link = screen.getByRole("link", { name: "Go to the home page" });
    expect(link).toHaveAttribute("href", "/");
  });

  it("navigates from not-found back to the home page", async () => {
    const user = userEvent.setup();
    renderApp("/unknown");
    await user.click(screen.getByRole("link", { name: "Go to the home page" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Parking Availability" }),
    ).toBeInTheDocument();
  });
});
