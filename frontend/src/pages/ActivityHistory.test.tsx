import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { adminApi } from "../api/adminApi";
import { ApiError } from "../api/client";
import type { AuditLogEntry } from "../types/audit";
import ActivityHistory from "./ActivityHistory";

const mockLogs: AuditLogEntry[] = [
  {
    id: "log-1",
    user: {
      id: "u1",
      name: "Hynek Manager",
      email: "hynek@gate.cz",
    },
    action: "Created parking spot A-101 in lot North Lot",
    createdAt: "2026-11-20T10:00:00.000Z",
  },
  {
    id: "log-2",
    user: {
      id: "u2",
      name: "Alice Admin",
      email: "alice@gate.cz",
    },
    action: "Created parking spot EV-01 in lot South Lot",
    createdAt: "2026-11-20T09:30:00.000Z",
  },
];

describe("ActivityHistory page", () => {
  it("shows loading state initially", () => {
    vi.spyOn(adminApi, "listAuditLogs").mockReturnValue(new Promise(() => {}));
    render(<ActivityHistory />);
    expect(screen.getByText("Loading activity history…")).toBeInTheDocument();
  });

  it("shows empty state when no logs exist", async () => {
    vi.spyOn(adminApi, "listAuditLogs").mockResolvedValue({ logs: [] });
    render(<ActivityHistory />);
    expect(
      await screen.findByText("No activity logs recorded yet."),
    ).toBeInTheDocument();
  });

  it("renders audit logs with user, action, and date/time", async () => {
    vi.spyOn(adminApi, "listAuditLogs").mockResolvedValue({ logs: mockLogs });
    render(<ActivityHistory />);

    expect(
      await screen.findByRole("heading", { name: "Activity History" }),
    ).toBeInTheDocument();

    expect(screen.getByText("Hynek Manager")).toBeInTheDocument();
    expect(screen.getByText("hynek@gate.cz")).toBeInTheDocument();
    expect(
      screen.getByText("Created parking spot A-101 in lot North Lot"),
    ).toBeInTheDocument();

    expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    expect(screen.getByText("alice@gate.cz")).toBeInTheDocument();
    expect(
      screen.getByText("Created parking spot EV-01 in lot South Lot"),
    ).toBeInTheDocument();
  });

  it("displays error message and allows retry on failure", async () => {
    vi.spyOn(adminApi, "listAuditLogs")
      .mockRejectedValueOnce(new ApiError("Failed to fetch logs", 500))
      .mockResolvedValueOnce({ logs: mockLogs });

    const user = userEvent.setup();
    render(<ActivityHistory />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to fetch logs",
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Hynek Manager")).toBeInTheDocument();
  });
});
