import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { ApiError } from "../api/client";
import { reservationApi } from "../api/reservationApi";
import { vehicleApi } from "../api/vehicleApi";
import type { CurrentReservation, ParkingLot } from "../types/reservation";
import Reservations from "./Reservations";

const lots: ParkingLot[] = [
  {
    id: "lot-1",
    name: "Main lot",
    address: "Main street 1",
    totalCapacity: 12,
    evCapacity: 2,
    disabledCapacity: 1,
  },
];

const upcoming: CurrentReservation = {
  id: "res-1",
  status: "reserved",
  startTime: new Date("2099-01-10T09:00").toISOString(),
  endTime: new Date("2099-01-10T11:00").toISOString(),
  vehicle: {
    id: "car-1",
    licensePlate: "1AB2345",
    brand: "Škoda",
    model: "Octavia",
    engineType: "combustion",
    size: "standard",
  },
  parkingSpot: {
    id: "spot-1",
    spotNumber: "E1",
    type: "ev",
    size: "standard",
    lotId: "lot-1",
  },
};

const parked: CurrentReservation = {
  ...upcoming,
  id: "res-2",
  status: "active",
  startTime: new Date("2000-01-10T09:00").toISOString(),
  parkingSpot: {
    id: "spot-2",
    spotNumber: "A2",
    type: "standard",
    size: "standard",
    lotId: "lot-1",
  },
};

function renderPage() {
  render(
    <MemoryRouter>
      <Reservations />
    </MemoryRouter>,
  );
}

async function findRow(spot: string) {
  const text = await screen.findByText(`Main lot, spot ${spot}`);
  return text.closest(".item") as HTMLElement;
}

describe("Reservations", () => {
  beforeEach(() => {
    vi.spyOn(reservationApi, "current").mockResolvedValue([upcoming, parked]);
    vi.spyOn(reservationApi, "lots").mockResolvedValue(lots);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists upcoming bookings with their status", async () => {
    renderPage();

    const row = await findRow("E1");
    expect(within(row).getByText("Booked")).toBeInTheDocument();
    expect(within(row).getByText("EV")).toBeInTheDocument();
    expect(within(row).getByText("1AB 2345")).toBeInTheDocument();
    expect(within(await findRow("A2")).getByText("Parked")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Book a spot" })).toHaveAttribute(
      "href",
      "/book",
    );
  });

  it("offers Change and Delete only for bookings that are not parked", async () => {
    renderPage();

    const row = await findRow("E1");
    expect(within(row).getByRole("button", { name: /Change/ })).toBeVisible();
    expect(within(row).getByRole("button", { name: /Delete/ })).toBeVisible();
    expect(
      within(await findRow("A2")).queryByRole("button"),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    vi.spyOn(reservationApi, "current").mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByText("No upcoming bookings."),
    ).toBeInTheDocument();
  });

  it("deletes a booking after confirmation", async () => {
    const remove = vi.spyOn(reservationApi, "remove").mockResolvedValue();
    const user = userEvent.setup();
    renderPage();

    await user.click(
      within(await findRow("E1")).getByRole("button", { name: /Delete/ }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Delete this booking?",
    });
    expect(dialog).toHaveTextContent("will be free again for others");
    await user.click(
      within(dialog).getByRole("button", { name: "Delete booking" }),
    );

    expect(remove).toHaveBeenCalledWith("res-1");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Booking deleted.",
    );
    expect(screen.queryByText("Main lot, spot E1")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the booking when the user says Keep it", async () => {
    const remove = vi.spyOn(reservationApi, "remove");
    const user = userEvent.setup();
    renderPage();

    await user.click(
      within(await findRow("E1")).getByRole("button", { name: /Delete/ }),
    );
    await user.click(screen.getByRole("button", { name: "Keep it" }));

    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByText("Main lot, spot E1")).toBeInTheDocument();
  });

  it("shows why a delete failed and keeps the dialog open", async () => {
    vi.spyOn(reservationApi, "remove").mockRejectedValue(
      new ApiError("Parking is in progress", 409),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(
      within(await findRow("E1")).getByRole("button", { name: /Delete/ }),
    );
    await user.click(screen.getByRole("button", { name: "Delete booking" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Parking is in progress",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens the change dialog and reloads after saving", async () => {
    vi.spyOn(vehicleApi, "list").mockResolvedValue([]);
    vi.spyOn(reservationApi, "availableSpots").mockResolvedValue([]);
    vi.spyOn(reservationApi, "update").mockResolvedValue({
      id: "res-1",
      userId: "user-1",
      vehicleId: "car-1",
      spotId: "spot-1",
      lotId: "lot-1",
      status: "reserved",
      startTime: upcoming.startTime,
      endTime: new Date("2099-01-10T12:00").toISOString(),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      within(await findRow("E1")).getByRole("button", { name: /Change/ }),
    );
    const dialog = screen.getByRole("dialog", { name: "Change booking" });
    fireEvent.change(within(dialog).getByLabelText("To"), {
      target: { value: "12:00" },
    });
    await within(dialog).findByRole("option", { name: "E1 (now)" });
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Booking updated.",
    );
    expect(reservationApi.current).toHaveBeenCalledTimes(2);
  });

  it("shows why bookings could not be loaded and retries", async () => {
    vi.spyOn(reservationApi, "current")
      .mockRejectedValueOnce(new ApiError("Cannot reach the server.", 0))
      .mockResolvedValue([upcoming]);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cannot reach the server.",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await findRow("E1")).toBeInTheDocument();
  });
});
