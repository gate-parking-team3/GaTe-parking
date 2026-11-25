import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "../api/client";
import { reservationApi } from "../api/reservationApi";
import { vehicleApi } from "../api/vehicleApi";
import type {
  ParkingLot,
  ParkingSpot,
  Reservation,
} from "../types/reservation";
import type { Vehicle } from "../types/vehicle";
import ReservationEditForm, {
  type EditableReservation,
} from "./ReservationEditForm";

// Local times, so the date and time inputs show 10 Jan 2099, 09:00–11:00.
const startTime = new Date("2099-01-10T09:00").toISOString();
const endTime = new Date("2099-01-10T11:00").toISOString();

const reservation: EditableReservation = {
  id: "res-1",
  status: "reserved",
  startTime,
  endTime,
  vehicleId: "car-1",
  spotId: "spot-1",
  lotId: "lot-1",
  spotNumber: "A1",
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

const spot2: ParkingSpot = {
  id: "spot-2",
  spotNumber: "A2",
  lotId: "lot-1",
  type: "ev",
  size: "large",
  status: "free",
};

const saved: Reservation = {
  ...reservation,
  userId: "user-1",
  spotId: "spot-2",
};

function renderForm(overrides: Partial<EditableReservation> = {}) {
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
    await screen.findByRole("option", { name: "A2 (EV)" }),
  ).toBeInTheDocument();
}

describe("ReservationEditForm", () => {
  beforeEach(() => {
    vi.spyOn(vehicleApi, "list").mockResolvedValue(vehicles);
    vi.spyOn(reservationApi, "lots").mockResolvedValue(lots);
    vi.spyOn(reservationApi, "availableSpots").mockResolvedValue([spot2]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens as a dialog prefilled with the booking", async () => {
    renderForm();
    await waitForSpots();

    expect(
      screen.getByRole("dialog", { name: "Change booking" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Vehicle")).toHaveValue("car-1");
    expect(screen.getByLabelText("Date")).toHaveValue("2099-01-10");
    expect(screen.getByLabelText("From")).toHaveValue("09:00");
    expect(screen.getByLabelText("To")).toHaveValue("11:00");
    expect(screen.getByLabelText("Lot")).toHaveValue("lot-1");
    expect(screen.getByLabelText("Spot")).toHaveValue("spot-1");
    expect(
      screen.getByRole("option", { name: "A1 (now)" }),
    ).toBeInTheDocument();
  });

  it("asks for free spots for the chosen vehicle, lot and time", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitForSpots();

    expect(reservationApi.availableSpots).toHaveBeenCalledWith("lot-1", {
      vehicleId: "car-1",
      start: startTime,
      end: endTime,
    });

    await user.selectOptions(screen.getByLabelText("Vehicle"), "car-2");
    await user.selectOptions(screen.getByLabelText("Lot"), "lot-2");

    expect(reservationApi.availableSpots).toHaveBeenLastCalledWith("lot-2", {
      vehicleId: "car-2",
      start: startTime,
      end: endTime,
    });
  });

  it("hides the vehicle choice when the user has one vehicle", async () => {
    vi.spyOn(vehicleApi, "list").mockResolvedValue(vehicles.slice(0, 1));
    renderForm();
    await waitForSpots();

    expect(screen.queryByLabelText("Vehicle")).not.toBeInTheDocument();
  });

  it("saves only the changed spot", async () => {
    const update = vi.spyOn(reservationApi, "update").mockResolvedValue(saved);
    const user = userEvent.setup();
    const { onSaved } = renderForm();
    await waitForSpots();

    await user.selectOptions(screen.getByLabelText("Spot"), "spot-2");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(update).toHaveBeenCalledWith("res-1", { spotId: "spot-2" });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("saves a new end time", async () => {
    const update = vi.spyOn(reservationApi, "update").mockResolvedValue(saved);
    renderForm();
    await waitForSpots();

    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "12:00" },
    });
    await waitForSpots();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(update).toHaveBeenCalledWith("res-1", {
      endTime: new Date("2099-01-10T12:00").toISOString(),
    });
  });

  it("picks a spot in the new lot when the lot changes", async () => {
    vi.spyOn(reservationApi, "availableSpots").mockResolvedValue([
      { ...spot2, id: "spot-9", spotNumber: "N1", lotId: "lot-2" },
    ]);
    const update = vi.spyOn(reservationApi, "update").mockResolvedValue(saved);
    const user = userEvent.setup();
    renderForm();
    await screen.findByRole("option", { name: "N1 (EV)" });

    await user.selectOptions(screen.getByLabelText("Lot"), "lot-2");
    expect(
      screen.queryByRole("option", { name: "A1 (now)" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(update).toHaveBeenCalledWith("res-1", { spotId: "spot-9" });
  });

  it("does not save when the end is before the start", async () => {
    const update = vi.spyOn(reservationApi, "update");
    renderForm();
    await waitForSpots();

    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "08:00" },
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
    const user = userEvent.setup();
    const { onSaved } = renderForm();
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

  it("explains that a started booking cannot be changed", async () => {
    const { onCancel } = renderForm({ status: "active" });

    expect(
      screen.getByText("Only bookings that haven't started can be changed."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Date")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("closes with Cancel and with Escape", async () => {
    const { onCancel } = renderForm();
    await waitForSpots();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
