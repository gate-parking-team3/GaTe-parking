import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { adminApi } from "../api/adminApi";
import { ApiError } from "../api/client";
import type { ParkingLot, ParkingSpot } from "../types/spot";
import AdminSpots from "./AdminSpots";

const mockLots: ParkingLot[] = [
  {
    id: "lot-1",
    name: "North Lot",
    address: "North Gate 1",
    totalCapacity: 20,
    evCapacity: 4,
    disabledCapacity: 2,
  },
  {
    id: "lot-2",
    name: "South Lot",
    address: "South Gate 2",
    totalCapacity: 30,
    evCapacity: 6,
    disabledCapacity: 4,
  },
];

const mockCreatedSpot: ParkingSpot = {
  id: "spot-101",
  spotNumber: "N-101",
  lotId: "lot-1",
  type: "ev",
  size: "large",
  status: "free",
};

describe("AdminSpots page", () => {
  it("loads and displays lots in the dropdown", async () => {
    vi.spyOn(adminApi, "listLots").mockResolvedValue(mockLots);
    vi.spyOn(adminApi, "listSpots").mockResolvedValue({ spots: [] });
    render(<AdminSpots />);

    expect(screen.getByText("Loading parking lots…")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Create Parking Spot" }),
    ).toBeInTheDocument();

    const select = screen.getByRole("combobox", { name: "Parking lot" });
    expect(select).toHaveValue("lot-1");
    expect(screen.getByText("North Lot (North Gate 1)")).toBeInTheDocument();
    expect(screen.getByText("South Lot (South Gate 2)")).toBeInTheDocument();
  });

  it("successfully creates a new parking spot and displays success message", async () => {
    vi.spyOn(adminApi, "listLots").mockResolvedValue(mockLots);
    vi.spyOn(adminApi, "listSpots").mockResolvedValue({ spots: [] });
    const createSpy = vi
      .spyOn(adminApi, "createSpot")
      .mockResolvedValue({ spot: mockCreatedSpot });

    const user = userEvent.setup();
    render(<AdminSpots />);

    await screen.findByRole("heading", { name: "Create Parking Spot" });

    await user.type(
      screen.getByRole("textbox", { name: "Spot number" }),
      "N-101",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Spot type" }),
      "ev",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Size" }),
      "large",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Initial availability" }),
      "free",
    );

    await user.click(screen.getByRole("button", { name: "Create Spot" }));

    expect(createSpy).toHaveBeenCalledWith({
      spotNumber: "N-101",
      lotId: "lot-1",
      type: "ev",
      size: "large",
      status: "free",
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      'Spot "N-101" created successfully!',
    );
  });

  it("displays server error when duplicate spot number is rejected (409)", async () => {
    vi.spyOn(adminApi, "listLots").mockResolvedValue(mockLots);
    vi.spyOn(adminApi, "listSpots").mockResolvedValue({ spots: [] });
    vi.spyOn(adminApi, "createSpot").mockRejectedValue(
      new ApiError('Spot "DUP" already exists', 409),
    );

    const user = userEvent.setup();
    render(<AdminSpots />);

    await screen.findByRole("heading", { name: "Create Parking Spot" });

    await user.type(
      screen.getByRole("textbox", { name: "Spot number" }),
      "DUP",
    );
    await user.click(screen.getByRole("button", { name: "Create Spot" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'Spot "DUP" already exists',
    );
  });
});
