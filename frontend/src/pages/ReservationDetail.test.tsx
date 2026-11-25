import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { reservationApi } from "../api/reservationApi";
import type { Reservation } from "../types/reservation";
import ReservationDetail from "./ReservationDetail";

const mockReservation: Reservation = {
  id: "res-123",
  userId: "u1",
  vehicleId: "veh-1",
  spotId: "spot-1",
  lotId: "lot-1",
  status: "reserved",
  startTime: "2026-11-20T10:00:00.000Z",
  endTime: "2026-11-20T12:00:00.000Z",
};

function renderDetail(route = "/reservations/res-123") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/reservations/:id" element={<ReservationDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ReservationDetail", () => {
  it("shows loading state initially", () => {
    vi.spyOn(reservationApi, "get").mockReturnValue(new Promise(() => {}));
    renderDetail();
    expect(screen.getByText("Loading reservation…")).toBeInTheDocument();
  });

  it("displays reservation details when found", async () => {
    vi.spyOn(reservationApi, "get").mockResolvedValue(mockReservation);
    renderDetail();

    expect(
      await screen.findByRole("heading", { name: "Reservation Details" }),
    ).toBeInTheDocument();
    expect(screen.getByText("res-123")).toBeInTheDocument();
    expect(screen.getByText("reserved")).toBeInTheDocument();
    expect(screen.getByText("spot-1")).toBeInTheDocument();
    expect(screen.getByText("veh-1")).toBeInTheDocument();
  });

  it("displays friendly message when reservation is 404 / deleted", async () => {
    vi.spyOn(reservationApi, "get").mockRejectedValue(
      new ApiError("Not found", 404),
    );
    renderDetail();

    expect(
      await screen.findByText("Reservation not found or has been deleted."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "← Back to Notifications" }),
    ).toHaveAttribute("href", "/notifications");
  });

  it("displays error message on server failure", async () => {
    vi.spyOn(reservationApi, "get").mockRejectedValue(
      new ApiError("Server error", 500),
    );
    renderDetail();

    expect(await screen.findByRole("alert")).toHaveTextContent("Server error");
  });
});
