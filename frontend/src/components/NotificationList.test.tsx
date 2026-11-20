import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { notificationApi } from "../api/notificationApi";
import type { NotificationRecord } from "../types/notification";
import NotificationList from "./NotificationList";

const mockNotifications: NotificationRecord[] = [
  {
    id: "n1",
    userId: "u1",
    reservationId: "res-1",
    type: "start_soon",
    title: "Parking starts soon",
    message: "Your reservation starts in 30 minutes or less.",
    createdAt: "2026-11-20T10:00:00.000Z",
    readAt: null,
    reservationUrl: "/reservations/res-1",
  },
  {
    id: "n2",
    userId: "u1",
    reservationId: "res-2",
    type: "end_soon",
    title: "Parking ends soon",
    message: "Your reservation ends in 15 minutes or less.",
    createdAt: "2026-11-20T09:45:00.000Z",
    readAt: "2026-11-20T09:50:00.000Z",
    reservationUrl: "/reservations/res-2",
  },
  {
    id: "n3",
    userId: "u1",
    reservationId: "res-3",
    type: "cancelled",
    title: "Reservation cancelled",
    message: "Your reservation was cancelled.",
    createdAt: "2026-11-20T09:00:00.000Z",
    readAt: null,
    reservationUrl: "/reservations/res-3",
  },
  {
    id: "n4",
    userId: "u1",
    reservationId: "res-4",
    type: "deleted",
    title: "Reservation deleted",
    message: "Your reservation was deleted by an administrator.",
    createdAt: "2026-11-20T08:30:00.000Z",
    readAt: null,
    reservationUrl: "/reservations/res-4",
  },
  {
    id: "n5",
    userId: "u1",
    reservationId: "res-5",
    type: "spot_unavailable",
    title: "Spot unavailable",
    message: "Your reserved spot is currently occupied.",
    createdAt: "2026-11-20T08:00:00.000Z",
    readAt: null,
    reservationUrl: "/reservations/res-5",
  },
];

function renderWithRouter(component: React.ReactElement) {
  return render(<MemoryRouter>{component}</MemoryRouter>);
}

describe("NotificationList", () => {
  it("shows loading state initially", () => {
    vi.spyOn(notificationApi, "list").mockReturnValue(new Promise(() => {}));
    renderWithRouter(<NotificationList />);
    expect(screen.getByText("Loading notifications…")).toBeInTheDocument();
  });

  it("shows empty state when no notifications exist", async () => {
    vi.spyOn(notificationApi, "list").mockResolvedValue([]);
    renderWithRouter(<NotificationList />);
    expect(
      await screen.findByText("You have no notifications."),
    ).toBeInTheDocument();
  });

  it("shows error state and allows retry", async () => {
    vi.spyOn(notificationApi, "list")
      .mockRejectedValueOnce(new ApiError("Failed to fetch", 500))
      .mockResolvedValueOnce(mockNotifications);

    const user = userEvent.setup();
    renderWithRouter(<NotificationList />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to fetch",
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Parking starts soon")).toBeInTheDocument();
  });

  it("renders all 5 notification triggers with details and links", async () => {
    vi.spyOn(notificationApi, "list").mockResolvedValue(mockNotifications);
    renderWithRouter(<NotificationList />);

    expect(
      await screen.findByRole("heading", { name: "Parking starts soon" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Parking ends soon" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Reservation cancelled" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Reservation deleted" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Spot unavailable" }),
    ).toBeInTheDocument();

    const links = screen.getAllByRole("link", { name: "View reservation" });
    expect(links).toHaveLength(5);
    expect(links[0]).toHaveAttribute("href", "/reservations/res-1");
  });

  it("allows marking an unread notification as read", async () => {
    vi.spyOn(notificationApi, "list").mockResolvedValue(
      mockNotifications.slice(0, 1),
    );
    const markReadSpy = vi
      .spyOn(notificationApi, "markRead")
      .mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderWithRouter(<NotificationList />);

    expect(await screen.findByText("Unread")).toBeInTheDocument();

    const markReadBtn = screen.getByRole("button", {
      name: 'Mark "Parking starts soon" as read',
    });
    await user.click(markReadBtn);

    expect(markReadSpy).toHaveBeenCalledWith("n1");
    expect(screen.queryByText("Unread")).not.toBeInTheDocument();
  });
});
