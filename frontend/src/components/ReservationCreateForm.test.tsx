import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { ApiError } from "../api/client";
import { reservationApi } from "../api/reservationApi";
import { vehicleApi } from "../api/vehicleApi";
import type {
  ParkingLot,
  ParkingSpot,
  Reservation,
} from "../types/reservation";
import type { Vehicle } from "../types/vehicle";
import ReservationCreateForm from "./ReservationCreateForm";

const startTime = new Date("2099-01-10T09:00").toISOString();
const endTime = new Date("2099-01-10T11:00").toISOString();

const octavia: Vehicle = {
  id: "car-1",
  userId: "user-1",
  licensePlate: "1AB2345",
  brand: "Škoda",
  model: "Octavia",
  engineType: "combustion",
  size: "standard",
};

const enyaq: Vehicle = {
  id: "car-2",
  userId: "user-1",
  licensePlate: "2EV0001",
  brand: "Škoda",
  model: "Enyaq",
  engineType: "electric",
  size: "large",
};

const lots: ParkingLot[] = [
  {
    id: "lot-1",
    name: "Main lot",
    address: "Main street 1",
    totalCapacity: 12,
    evCapacity: 2,
    disabledCapacity: 1,
  },
  {
    id: "lot-2",
    name: "North lot",
    address: "North street 2",
    totalCapacity: 4,
    evCapacity: 1,
    disabledCapacity: 0,
  },
];

const spotA1: ParkingSpot = {
  id: "spot-1",
  spotNumber: "A1",
  lotId: "lot-1",
  type: "standard",
  size: "large",
  status: "free",
};

const spotE1: ParkingSpot = {
  id: "spot-2",
  spotNumber: "E1",
  lotId: "lot-1",
  type: "ev",
  size: "standard",
  status: "free",
};

const created: Reservation = {
  id: "res-1",
  userId: "user-1",
  vehicleId: "car-1",
  spotId: "spot-1",
  lotId: "lot-1",
  status: "reserved",
  startTime,
  endTime,
};

function renderForm() {
  const onCreated = vi.fn();
  render(
    <MemoryRouter>
      <ReservationCreateForm onCreated={onCreated} />
    </MemoryRouter>,
  );
  return { onCreated };
}

async function fillWindow(date = "2099-01-10", from = "09:00", to = "11:00") {
  fireEvent.change(await screen.findByLabelText("Date"), {
    target: { value: date },
  });
  fireEvent.change(screen.getByLabelText("From"), { target: { value: from } });
  fireEvent.change(screen.getByLabelText("To"), { target: { value: to } });
}

describe("ReservationCreateForm", () => {
  beforeEach(() => {
    vi.spyOn(vehicleApi, "list").mockResolvedValue([octavia, enyaq]);
    vi.spyOn(reservationApi, "lots").mockResolvedValue(lots);
    vi.spyOn(reservationApi, "availableSpots").mockResolvedValue([
      spotA1,
      spotE1,
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the three steps with the first vehicle and lot selected", async () => {
    renderForm();

    expect(await screen.findByText("Vehicle")).toBeInTheDocument();
    expect(screen.getByText("When")).toBeInTheDocument();
    expect(screen.getByText("Spot")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Octavia/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Main lot" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Tap a free spot")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Book" })).toBeDisabled();
  });

  it("shows the free spots as tiles, with a bolt on EV spots", async () => {
    renderForm();
    await fillWindow();

    expect(
      await screen.findByRole("button", { name: "Spot A1" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Spot E1, EV" })).toBeVisible();
    expect(screen.getByText("2 spots free for your vehicle.")).toBeVisible();
  });

  it("asks for free spots for the chosen vehicle, lot and time", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillWindow();
    await screen.findByRole("button", { name: "Spot A1" });

    expect(reservationApi.availableSpots).toHaveBeenLastCalledWith("lot-1", {
      vehicleId: "car-1",
      start: startTime,
      end: endTime,
    });

    await user.click(screen.getByRole("button", { name: "North lot" }));
    expect(reservationApi.availableSpots).toHaveBeenLastCalledWith("lot-2", {
      vehicleId: "car-1",
      start: startTime,
      end: endTime,
    });

    await user.click(screen.getByRole("radio", { name: /Enyaq/ }));
    expect(reservationApi.availableSpots).toHaveBeenLastCalledWith("lot-2", {
      vehicleId: "car-2",
      start: startTime,
      end: endTime,
    });
  });

  it("books the chosen spot", async () => {
    const create = vi
      .spyOn(reservationApi, "create")
      .mockResolvedValue(created);
    const user = userEvent.setup();
    const { onCreated } = renderForm();
    await fillWindow();

    await user.click(await screen.findByRole("button", { name: "Spot A1" }));
    expect(screen.getByRole("button", { name: "Spot A1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Book spot A1" }));

    expect(create).toHaveBeenCalledWith({
      vehicleId: "car-1",
      spotId: "spot-1",
      startTime,
      endTime,
    });
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it("does not book without a chosen spot", async () => {
    const create = vi.spyOn(reservationApi, "create");
    renderForm();
    await fillWindow();
    await screen.findByRole("button", { name: "Spot A1" });

    fireEvent.submit(screen.getByRole("button", { name: "Book" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Tap a free spot first.",
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("does not search when the end is before the start", async () => {
    const create = vi.spyOn(reservationApi, "create");
    renderForm();
    await fillWindow("2099-01-10", "11:00", "09:00");

    expect(
      screen.getByText("The end time must be after the start time."),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Spot A1" }),
    ).not.toBeInTheDocument();
    expect(reservationApi.availableSpots).not.toHaveBeenCalledWith(
      "lot-1",
      expect.objectContaining({ start: expect.any(String), end: startTime }),
    );

    fireEvent.submit(screen.getByRole("button", { name: "Book" }));
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a time that has already passed", async () => {
    const create = vi.spyOn(reservationApi, "create");
    renderForm();
    await fillWindow("2000-01-10");
    await screen.findByRole("button", { name: "Spot A1" });

    fireEvent.submit(screen.getByRole("button", { name: "Book" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "That time has already passed.",
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("says when no spot is free", async () => {
    vi.spyOn(reservationApi, "availableSpots").mockResolvedValue([]);
    renderForm();
    await fillWindow();

    expect(
      await screen.findByText(/Nothing free for your vehicle at this time/),
    ).toBeInTheDocument();
  });

  it("shows the server's message and reloads spots when the spot was taken", async () => {
    vi.spyOn(reservationApi, "create").mockRejectedValue(
      new ApiError("The spot is already booked for that time", 409),
    );
    const user = userEvent.setup();
    const { onCreated } = renderForm();
    await fillWindow();

    await user.click(await screen.findByRole("button", { name: "Spot A1" }));
    const lookups = vi.mocked(reservationApi.availableSpots).mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Book spot A1" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The spot is already booked for that time",
    );
    expect(
      await screen.findByRole("button", { name: "Spot A1" }),
    ).toBeInTheDocument();
    expect(reservationApi.availableSpots).toHaveBeenCalledTimes(lookups + 1);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("shows a single vehicle without a picker, tagged EV when electric", async () => {
    vi.spyOn(vehicleApi, "list").mockResolvedValue([enyaq]);
    renderForm();

    expect(await screen.findByText("Škoda Enyaq")).toBeInTheDocument();
    expect(screen.getByText("Electric")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("asks to add a vehicle when the user has none", async () => {
    vi.spyOn(vehicleApi, "list").mockResolvedValue([]);
    renderForm();

    expect(
      await screen.findByRole("link", { name: "Add a vehicle" }),
    ).toHaveAttribute("href", "/vehicles");
  });

  it("shows why the form could not be loaded", async () => {
    vi.spyOn(reservationApi, "lots").mockRejectedValue(
      new ApiError("Cannot reach the server. Please try again.", 0),
    );
    renderForm();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cannot reach the server",
    );
  });
});
