import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "../api/client";
import { vehicleApi } from "../api/vehicleApi";
import type { Vehicle } from "../types/vehicle";
import Vehicles from "./Vehicles";

const octavia: Vehicle = {
  id: "1",
  userId: "user-1",
  licensePlate: "1AB2345",
  brand: "Škoda",
  model: "Octavia",
  engineType: "combustion",
  size: "standard",
};

describe("Vehicles page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the user's vehicles under the page heading", async () => {
    vi.spyOn(vehicleApi, "list").mockResolvedValue([octavia]);
    render(<Vehicles />);

    expect(
      screen.getByRole("heading", { level: 1, name: "My Vehicles" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("1AB2345")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit 1AB2345" }),
    ).toBeInTheDocument();
  });

  it("shows the server's message when the user is not signed in", async () => {
    vi.spyOn(vehicleApi, "list").mockRejectedValue(
      new ApiError("Authentication is required", 401),
    );
    render(<Vehicles />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Authentication is required",
    );
  });

  it("opens add vehicle modal and adds a new vehicle", async () => {
    const user = userEvent.setup();
    const listSpy = vi
      .spyOn(vehicleApi, "list")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([octavia]);
    const createSpy = vi.spyOn(vehicleApi, "create").mockResolvedValue(octavia);

    render(<Vehicles />);

    await user.click(screen.getByRole("button", { name: "Add a vehicle" }));
    expect(
      screen.getByRole("heading", { name: "Add a vehicle" }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("License plate"), "1AB2345");
    await user.type(screen.getByLabelText("Brand"), "Škoda");
    await user.type(screen.getByLabelText("Model"), "Octavia");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    expect(createSpy).toHaveBeenCalledWith({
      licensePlate: "1AB2345",
      brand: "Škoda",
      model: "Octavia",
      engineType: "combustion",
      size: "standard",
    });
    expect(listSpy).toHaveBeenCalledTimes(2);
  });
});
