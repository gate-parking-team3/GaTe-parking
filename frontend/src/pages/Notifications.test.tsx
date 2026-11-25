import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { notificationApi } from "../api/notificationApi";
import { DEFAULT_NOTIFICATION_SETTINGS } from "../types/notification";
import Notifications from "./Notifications";

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <Notifications />
    </MemoryRouter>,
  );
}

describe("Notifications page", () => {
  it("renders page heading and defaults to My Notifications tab", async () => {
    vi.spyOn(notificationApi, "list").mockResolvedValue([]);
    renderWithRouter();

    expect(
      screen.getByRole("heading", { level: 1, name: "Notifications" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("You have no notifications."),
    ).toBeInTheDocument();
  });

  it("switches to Notification Settings tab when clicked", async () => {
    vi.spyOn(notificationApi, "list").mockResolvedValue([]);
    vi.spyOn(notificationApi, "settings").mockResolvedValue(
      DEFAULT_NOTIFICATION_SETTINGS,
    );

    const user = userEvent.setup();
    renderWithRouter();

    const settingsTab = screen.getByRole("tab", {
      name: "Notification Settings",
    });
    await user.click(settingsTab);

    expect(
      await screen.findByRole("heading", { name: "Notification Preferences" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("You have no notifications."),
    ).not.toBeInTheDocument();
  });
});
