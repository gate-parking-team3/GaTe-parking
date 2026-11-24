import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { reservationApi } from "../api/reservationApi";
import { vehicleApi } from "../api/vehicleApi";
import type { Reservation } from "../types/reservation";
import Book from "./Book";

const created: Reservation = {
  id: "res-1",
  userId: "user-1",
  vehicleId: "car-1",
  spotId: "spot-1",
  lotId: "lot-1",
  status: "reserved",
  startTime: new Date("2099-01-10T09:00").toISOString(),
  endTime: new Date("2099-01-10T11:00").toISOString(),
};

describe("Book", () => {
  beforeEach(() => {
    vi.spyOn(vehicleApi, "list").mockResolvedValue([
      {
        id: "car-1",
        userId: "user-1",
        licensePlate: "1AB2345",
        brand: "Škoda",
        model: "Octavia",
        engineType: "combustion",
        size: "standard",
      },
    ]);
    vi.spyOn(reservationApi, "lots").mockResolvedValue([
      {
        id: "lot-1",
        name: "Main lot",
        address: "Main street 1",
        totalCapacity: 12,
        evCapacity: 2,
        disabledCapacity: 1,
      },
    ]);
    vi.spyOn(reservationApi, "availableSpots").mockResolvedValue([
      {
        id: "spot-1",
        spotNumber: "A1",
        lotId: "lot-1",
        type: "standard",
        size: "standard",
        status: "free",
      },
    ]);
    vi.spyOn(reservationApi, "create").mockResolvedValue(created);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("confirms the booking and lets the user book another", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Book />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Book a spot" }),
    ).toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText("Date"), {
      target: { value: "2099-01-10" },
    });
    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "09:00" },
    });
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "11:00" },
    });
    await user.click(await screen.findByRole("button", { name: "Spot A1" }));
    await user.click(screen.getByRole("button", { name: "Book spot A1" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your spot is booked",
    );
    expect(
      screen.getByRole("link", { name: "See my bookings" }),
    ).toHaveAttribute("href", "/reservations");

    await user.click(screen.getByRole("button", { name: "Book another spot" }));
    expect(await screen.findByLabelText("Date")).toBeInTheDocument();
  });
});
