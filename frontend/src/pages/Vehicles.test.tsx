import { render, screen } from "@testing-library/react";
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
});
