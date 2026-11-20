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
import { toLocalInput } from "./ReservationEditForm";

const startTime = "2099-01-10T09:00:00.000Z";
const endTime = "2099-01-10T11:00:00.000Z";

const vehicles: Vehicle[] = [
  {
    id: "car-1",
    userId: "user-1",
    licensePlate: "1AB2345",
    brand: "Škoda",
    model: "Octavia",
    engineType: "combustion",
    size: "standard",
  },
  {
    id: "car-2",
    userId: "user-1",
    licensePlate: "2EV0001",
    brand: "Škoda",
    model: "Enyaq",
    engineType: "electric",
    size: "large",
  },
];

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

const spot: ParkingSpot = {
  id: "spot-1",
  spotNumber: "A1",
  lotId: "lot-1",
  type: "standard",
  size: "large",
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

async function fillWindow(start = startTime, end = endTime) {
  fireEvent.change(await screen.findByLabelText("Start"), {
    target: { value: toLocalInput(start) },
  });
  fireEvent.change(screen.getByLabelText("End"), {
    target: { value: toLocalInput(end) },
  });
}

async function waitForSpots() {
  expect(
    await screen.findByRole("option", { name: "Spot A1 (Standard, large)" }),
  ).toBeInTheDocument();
}

describe("ReservationCreateForm", () => {
  beforeEach(() => {
    vi.spyOn(vehicleApi, "list").mockResolvedValue(vehicles);
    vi.spyOn(reservationApi, "lots").mockResolvedValue(lots);
    vi.spyOn(reservationApi, "availableSpots").mockResolvedValue([spot]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks for a time window before showing spots", async () => {
    renderForm();

    expect(
      await screen.findByText(/Choose a start and an end time/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Vehicle")).toHaveValue("car-1");
    expect(screen.getByLabelText("Parking lot")).toHaveValue("lot-1");
    expect(reservationApi.availableSpots).not.toHaveBeenCalled();
  });

  it("asks for free spots for the chosen vehicle, lot and time", async () => {
    renderForm();
    await fillWindow();
    await waitForSpots();

    expect(reservationApi.availableSpots).toHaveBeenCalledWith("lot-1", {
      vehicleId: "car-1",
      start: startTime,
      end: endTime,
      evOnly: false,
    });

    await userEvent.selectOptions(
      screen.getByLabelText("Parking lot"),
      "lot-2",
    );

    expect(reservationApi.availableSpots).toHaveBeenLastCalledWith("lot-2", {
      vehicleId: "car-1",
      start: startTime,
      end: endTime,
      evOnly: false,
    });
  });

  it("offers the EV-only filter for electric cars only", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillWindow();
    await waitForSpots();

    expect(screen.queryByLabelText("EV spots only")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Vehicle"), "car-2");
    await user.click(screen.getByLabelText("EV spots only"));

    expect(reservationApi.availableSpots).toHaveBeenLastCalledWith("lot-1", {
      vehicleId: "car-2",
      start: startTime,
      end: endTime,
      evOnly: true,
    });
  });

  it("books the chosen spot", async () => {
    const create = vi
      .spyOn(reservationApi, "create")
      .mockResolvedValue(created);
    const user = userEvent.setup();
    const { onCreated } = renderForm();
    await fillWindow();
    await waitForSpots();

    await user.selectOptions(screen.getByLabelText("Spot"), "spot-1");
    await user.click(screen.getByRole("button", { name: "Reserve" }));

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
    await waitForSpots();

    fireEvent.submit(screen.getByRole("button", { name: "Reserve" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a parking spot first.",
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("does not search when the end is before the start", async () => {
    const create = vi.spyOn(reservationApi, "create");
    renderForm();
    await fillWindow(endTime, startTime);

    fireEvent.submit(screen.getByRole("button", { name: "Reserve" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The end time must be after the start time.",
    );
    expect(reservationApi.availableSpots).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("says when no spot is free", async () => {
    vi.spyOn(reservationApi, "availableSpots").mockResolvedValue([]);
    renderForm();
    await fillWindow();

    expect(
      await screen.findByText(/No suitable spot is free for this time/),
    ).toBeInTheDocument();
  });

  it("shows the server's message and reloads spots when the spot was taken", async () => {
    vi.spyOn(reservationApi, "create").mockRejectedValue(
      new ApiError("The spot is already booked for that time", 409),
    );
    const user = userEvent.setup();
    const { onCreated } = renderForm();
    await fillWindow();
    await waitForSpots();

    await user.selectOptions(screen.getByLabelText("Spot"), "spot-1");
    await user.click(screen.getByRole("button", { name: "Reserve" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The spot is already booked for that time",
    );
    await waitForSpots();
    expect(reservationApi.availableSpots).toHaveBeenCalledTimes(2);
    expect(onCreated).not.toHaveBeenCalled();
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
