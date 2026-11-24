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
      screen.getByRole("heading", { level: 1, name: "My vehicles" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("1AB 2345")).toBeInTheDocument();
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
    expect(
      screen.queryByRole("heading", { name: "Add a vehicle" }),
    ).not.toBeInTheDocument();
  });

  it("shows a message next to the plate field when the plate is invalid", async () => {
    const user = userEvent.setup();
    vi.spyOn(vehicleApi, "list").mockResolvedValue([]);
    const createSpy = vi.spyOn(vehicleApi, "create");

    render(<Vehicles />);

    await user.click(screen.getByRole("button", { name: "Add a vehicle" }));
    await user.type(screen.getByLabelText("License plate"), "!");
    await user.type(screen.getByLabelText("Brand"), "Škoda");
    await user.type(screen.getByLabelText("Model"), "Octavia");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    expect(screen.getByLabelText("License plate")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText(/letters or digits/)).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("shows the server's message and keeps the modal open when adding fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(vehicleApi, "list").mockResolvedValue([]);
    vi.spyOn(vehicleApi, "create").mockRejectedValue(
      new ApiError("This license plate is already registered", 409),
    );

    render(<Vehicles />);

    await user.click(screen.getByRole("button", { name: "Add a vehicle" }));
    await user.type(screen.getByLabelText("License plate"), "1AB2345");
    await user.type(screen.getByLabelText("Brand"), "Škoda");
    await user.type(screen.getByLabelText("Model"), "Octavia");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This license plate is already registered",
    );
    expect(
      screen.getByRole("heading", { name: "Add a vehicle" }),
    ).toBeInTheDocument();
  });

  it("closes the modal with Escape and with Cancel", async () => {
    const user = userEvent.setup();
    vi.spyOn(vehicleApi, "list").mockResolvedValue([]);

    render(<Vehicles />);

    await user.click(screen.getByRole("button", { name: "Add a vehicle" }));
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("heading", { name: "Add a vehicle" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add a vehicle" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("heading", { name: "Add a vehicle" }),
    ).not.toBeInTheDocument();
  });
});
