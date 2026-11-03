import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "../api/client";
import { vehicleApi } from "../api/vehicleApi";
import type { Vehicle } from "../types/vehicle";
import VehicleList from "./VehicleList";

const octavia: Vehicle = {
  id: "1",
  licensePlate: "1AB2345",
  brand: "Škoda",
  model: "Octavia",
  engineType: "combustion",
  size: "standard",
};

const enyaq: Vehicle = {
  id: "2",
  licensePlate: "2EV0001",
  brand: "Škoda",
  model: "Enyaq",
  engineType: "electric",
  size: "large",
};

describe("VehicleList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading message until the vehicles arrive", async () => {
    vi.spyOn(vehicleApi, "list").mockResolvedValue([octavia]);
    render(<VehicleList />);

    expect(screen.getByText("Loading vehicles…")).toBeInTheDocument();
    expect(await screen.findByText("1AB2345")).toBeInTheDocument();
    expect(screen.queryByText("Loading vehicles…")).not.toBeInTheDocument();
  });

  it("lists the vehicles", async () => {
    vi.spyOn(vehicleApi, "list").mockResolvedValue([octavia, enyaq]);
    render(<VehicleList />);

    expect(await screen.findByText("2EV0001")).toBeInTheDocument();
    expect(screen.getByText("Octavia")).toBeInTheDocument();
    expect(screen.getByText("Electric")).toBeInTheDocument();
    expect(screen.getByText("Large")).toBeInTheDocument();
  });

  it("says so when there are no vehicles", async () => {
    vi.spyOn(vehicleApi, "list").mockResolvedValue([]);
    render(<VehicleList />);

    expect(
      await screen.findByText("You have no vehicles yet."),
    ).toBeInTheDocument();
  });

  it("shows the error and loads again on retry", async () => {
    const list = vi
      .spyOn(vehicleApi, "list")
      .mockRejectedValueOnce(new ApiError("Cannot reach the server.", 0))
      .mockResolvedValueOnce([octavia]);
    render(<VehicleList />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cannot reach the server.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("1AB2345")).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("edits a vehicle and shows the saved data", async () => {
    vi.spyOn(vehicleApi, "list").mockResolvedValue([octavia, enyaq]);
    vi.spyOn(vehicleApi, "update").mockResolvedValue({
      ...octavia,
      model: "Superb",
    });
    render(<VehicleList />);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: "Edit 1AB2345" }),
    );
    expect(screen.getByLabelText("Model")).toHaveValue("Octavia");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Superb")).toBeInTheDocument();
    expect(screen.queryByText("Octavia")).not.toBeInTheDocument();
    expect(screen.getByText("Enyaq")).toBeInTheDocument();
  });

  it("goes back to the list when editing is cancelled", async () => {
    vi.spyOn(vehicleApi, "list").mockResolvedValue([octavia]);
    render(<VehicleList />);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: "Edit 1AB2345" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("heading", { name: "My vehicles" }),
    ).toBeInTheDocument();
  });
});
