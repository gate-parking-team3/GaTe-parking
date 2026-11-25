import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { notificationApi } from "../api/notificationApi";
import { DEFAULT_NOTIFICATION_SETTINGS } from "../types/notification";
import NotificationSettingsForm from "./NotificationSettingsForm";

describe("NotificationSettingsForm", () => {
  it("shows loading state initially", async () => {
    vi.spyOn(notificationApi, "settings").mockReturnValue(
      new Promise(() => {}),
    );
    render(<NotificationSettingsForm />);
    expect(
      screen.getByText("Loading notification settings…"),
    ).toBeInTheDocument();
  });

  it("renders all notification toggles enabled by default", async () => {
    vi.spyOn(notificationApi, "settings").mockResolvedValue(
      DEFAULT_NOTIFICATION_SETTINGS,
    );
    render(<NotificationSettingsForm />);

    expect(
      await screen.findByRole("heading", { name: "Notification Preferences" }),
    ).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(5);
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toBeChecked();
    });
  });

  it("toggles a setting and persists it via API", async () => {
    vi.spyOn(notificationApi, "settings").mockResolvedValue(
      DEFAULT_NOTIFICATION_SETTINGS,
    );
    const updateSpy = vi
      .spyOn(notificationApi, "updateSettings")
      .mockResolvedValue({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        start_soon: false,
      });

    const user = userEvent.setup();
    render(<NotificationSettingsForm />);

    const startSoonCheckbox = await screen.findByRole("checkbox", {
      name: /Reservation starts soon/,
    });
    expect(startSoonCheckbox).toBeChecked();

    await user.click(startSoonCheckbox);

    expect(updateSpy).toHaveBeenCalledWith({ start_soon: false });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Preferences saved.",
    );
  });

  it("reverts toggle and shows error when update fails", async () => {
    vi.spyOn(notificationApi, "settings").mockResolvedValue(
      DEFAULT_NOTIFICATION_SETTINGS,
    );
    vi.spyOn(notificationApi, "updateSettings").mockRejectedValue(
      new ApiError("Failed to save preference.", 500),
    );

    const user = userEvent.setup();
    render(<NotificationSettingsForm />);

    const startSoonCheckbox = await screen.findByRole("checkbox", {
      name: /Reservation starts soon/,
    });

    await user.click(startSoonCheckbox);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to save preference.",
    );
    expect(startSoonCheckbox).toBeChecked();
  });

  it("shows error and allows retry when initial settings load fails", async () => {
    vi.spyOn(notificationApi, "settings")
      .mockRejectedValueOnce(new ApiError("Cannot reach server", 0))
      .mockResolvedValueOnce(DEFAULT_NOTIFICATION_SETTINGS);

    const user = userEvent.setup();
    render(<NotificationSettingsForm />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cannot reach server",
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { name: "Notification Preferences" }),
    ).toBeInTheDocument();
  });
});
