import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "../api/client";
import { reservationApi } from "../api/reservationApi";
import { vehicleApi } from "../api/vehicleApi";
import type { ParkingSpot, Reservation } from "../types/reservation";
import type { Vehicle } from "../types/vehicle";
import ReservationEditForm, { toLocalInput } from "./ReservationEditForm";

const reservation: Reservation = {
  id: "res-1",
  userId: "user-1",
  vehicleId: "car-1",
  spotId: "spot-1",
  lotId: "lot-1",
  status: "reserved",
  startTime: "2099-01-10T09:00:00.000Z",
  endTime: "2099-01-10T11:00:00.000Z",
};

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

const spot2: ParkingSpot = {
  id: "spot-2",
  spotNumber: "A2",
  lotId: "lot-1",
  type: "standard",
  size: "large",
  status: "free",
};

function renderForm(overrides: Partial<Reservation> = {}) {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  render(
    <ReservationEditForm
      reservation={{ ...reservation, ...overrides }}
      onSaved={onSaved}
      onCancel={onCancel}
    />,
  );
  return { onSaved, onCancel };
}

async function waitForSpots() {
  expect(
    await screen.findByRole("option", { name: "Spot A2 (Standard, large)" }),
  ).toBeInTheDocument();
}

describe("ReservationEditForm", () => {
  beforeEach(() => {
    vi.spyOn(vehicleApi, "list").mockResolvedValue(vehicles);
    vi.spyOn(reservationApi, "availableSpots").mockResolvedValue([spot2]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is prefilled with the reservation's current data", async () => {
    renderForm();
    await waitForSpots();

    expect(screen.getByLabelText("Vehicle")).toHaveValue("car-1");
    expect(screen.getByLabelText("Start")).toHaveValue(
      toLocalInput(reservation.startTime),
    );
    expect(screen.getByLabelText("End")).toHaveValue(
      toLocalInput(reservation.endTime),
    );
    expect(screen.getByLabelText("Spot")).toHaveValue("spot-1");
    expect(
      screen.getByRole("option", { name: "Current spot" }),
    ).toBeInTheDocument();
  });

  it("asks for free spots for the chosen vehicle and time", async () => {
    renderForm();
    await waitForSpots();

    expect(reservationApi.availableSpots).toHaveBeenCalledWith("lot-1", {
      vehicleId: "car-1",
      start: reservation.startTime,
      end: reservation.endTime,
    });

    await userEvent.selectOptions(screen.getByLabelText("Vehicle"), "car-2");

    expect(reservationApi.availableSpots).toHaveBeenLastCalledWith("lot-1", {
      vehicleId: "car-2",
      start: reservation.startTime,
      end: reservation.endTime,
    });
  });

  it("saves only the changed spot", async () => {
    const saved = { ...reservation, spotId: "spot-2" };
    const update = vi.spyOn(reservationApi, "update").mockResolvedValue(saved);
    const { onSaved } = renderForm();
    const user = userEvent.setup();
    await waitForSpots();

    await user.selectOptions(screen.getByLabelText("Spot"), "spot-2");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(update).toHaveBeenCalledWith("res-1", { spotId: "spot-2" });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("saves a new time window", async () => {
    const update = vi
      .spyOn(reservationApi, "update")
      .mockResolvedValue(reservation);
    renderForm();
    await waitForSpots();

    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: toLocalInput("2099-01-10T12:00:00.000Z") },
    });
    await waitForSpots();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(update).toHaveBeenCalledWith("res-1", {
      endTime: "2099-01-10T12:00:00.000Z",
    });
  });

  it("does not save when the end is before the start", async () => {
    const update = vi.spyOn(reservationApi, "update");
    renderForm();
    await waitForSpots();

    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: toLocalInput("2099-01-10T08:00:00.000Z") },
    });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The end time must be after the start time.",
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("says so when nothing has changed", async () => {
    const update = vi.spyOn(reservationApi, "update");
    renderForm();
    await waitForSpots();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nothing has changed yet.",
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("shows the server's message when the change conflicts", async () => {
    vi.spyOn(reservationApi, "update").mockRejectedValue(
      new ApiError("The spot is already booked for that time", 409),
    );
    const { onSaved } = renderForm();
    const user = userEvent.setup();
    await waitForSpots();

    await user.selectOptions(screen.getByLabelText("Spot"), "spot-2");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The spot is already booked for that time",
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("shows why free spots could not be loaded", async () => {
    vi.spyOn(reservationApi, "availableSpots").mockRejectedValue(
      new ApiError("Lot not found", 404),
    );
    renderForm();

    expect(await screen.findByRole("alert")).toHaveTextContent("Lot not found");
  });

  it("explains that a started reservation cannot be edited", async () => {
    const { onCancel } = renderForm({ status: "active" });

    expect(
      screen.getByText(/Only upcoming reservations can be edited/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Start")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel when cancelled", async () => {
    const { onCancel } = renderForm();
    await waitForSpots();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
  });
});
