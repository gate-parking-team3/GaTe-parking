import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { reservationApi } from "../api/reservationApi";
import { vehicleApi } from "../api/vehicleApi";
import { toLocalInput } from "../components/ReservationEditForm";
import type { Reservation } from "../types/reservation";
import ReserveSpot from "./ReserveSpot";

const created: Reservation = {
  id: "res-1",
  userId: "user-1",
  vehicleId: "car-1",
  spotId: "spot-1",
  lotId: "lot-1",
  status: "reserved",
  startTime: "2099-01-10T09:00:00.000Z",
  endTime: "2099-01-10T11:00:00.000Z",
};

describe("ReserveSpot", () => {
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
        <ReserveSpot />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText("Start"), {
      target: { value: toLocalInput(created.startTime) },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: toLocalInput(created.endTime) },
    });
    await screen.findByRole("option", { name: "Spot A1 (Standard, standard)" });
    await user.selectOptions(screen.getByLabelText("Spot"), "spot-1");
    await user.click(screen.getByRole("button", { name: "Reserve" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your spot is reserved",
    );
    expect(
      screen.getByRole("link", { name: "See my reservations" }),
    ).toHaveAttribute("href", "/reservations");

    await user.click(
      screen.getByRole("button", { name: "Reserve another spot" }),
    );
    expect(await screen.findByLabelText("Vehicle")).toBeInTheDocument();
  });
});
