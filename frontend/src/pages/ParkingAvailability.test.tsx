import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { ApiError } from "../api/client";
import { lotApi } from "../api/lotApi";
import type { ParkingLot, ParkingLotDetail } from "../types/lot";
import ParkingAvailability from "./ParkingAvailability";

const mockLots: ParkingLot[] = [
  {
    id: "lot-1",
    name: "Main Lot",
    address: "Main Street 1",
    totalCapacity: 12,
    evCapacity: 2,
    disabledCapacity: 1,
    availability: {
      total: 12,
      available: 9,
      occupied: 2,
      reserved: 1,
    },
  },
  {
    id: "lot-2",
    name: "North Lot",
    address: "North Boulevard 5",
    totalCapacity: 4,
    evCapacity: 1,
    disabledCapacity: 1,
    availability: {
      total: 4,
      available: 4,
      occupied: 0,
      reserved: 0,
    },
  },
];

const mockLotDetail: ParkingLotDetail = {
  id: "lot-1",
  name: "Main Lot",
  address: "Main Street 1",
  totalCapacity: 4,
  evCapacity: 2,
  disabledCapacity: 1,
  availability: {
    total: 4,
    available: 2,
    occupied: 1,
    reserved: 1,
  },
  spots: [
    {
      id: "spot-1",
      spotNumber: "A1",
      lotId: "lot-1",
      type: "standard",
      size: "standard",
      status: "free",
    },
    {
      id: "spot-2",
      spotNumber: "A2",
      lotId: "lot-1",
      type: "ev",
      size: "standard",
      status: "free",
    },
    {
      id: "spot-3",
      spotNumber: "A3",
      lotId: "lot-1",
      type: "standard",
      size: "small",
      status: "occupied",
    },
    {
      id: "spot-4",
      spotNumber: "A4",
      lotId: "lot-1",
      type: "disabled",
      size: "large",
      status: "reserved",
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ParkingAvailability />
    </MemoryRouter>,
  );
}

describe("ParkingAvailability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading message while fetching parking lots", async () => {
    vi.spyOn(lotApi, "list").mockResolvedValue(mockLots);
    renderPage();

    expect(screen.getByText("Loading parking lots…")).toBeInTheDocument();
    expect(await screen.findByText("Main Lot")).toBeInTheDocument();
    expect(screen.queryByText("Loading parking lots…")).not.toBeInTheDocument();
  });

  it("lists parking lots with availability counts and info", async () => {
    vi.spyOn(lotApi, "list").mockResolvedValue(mockLots);
    renderPage();

    expect(await screen.findByText("Main Lot")).toBeInTheDocument();
    expect(screen.getByText("North Lot")).toBeInTheDocument();
    expect(screen.getByText("Main Street 1")).toBeInTheDocument();
    expect(screen.getByText("North Boulevard 5")).toBeInTheDocument();

    expect(screen.getByText("9 of 12 spots free")).toBeInTheDocument();
    expect(screen.getByText("4 of 4 spots free")).toBeInTheDocument();
  });

  it("shows empty state when no parking lots exist", async () => {
    vi.spyOn(lotApi, "list").mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByText("No parking lots available."),
    ).toBeInTheDocument();
  });

  it("shows error alert and reloads on retry", async () => {
    const listSpy = vi
      .spyOn(lotApi, "list")
      .mockRejectedValueOnce(new ApiError("Failed to fetch lots.", 500))
      .mockResolvedValueOnce(mockLots);

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to fetch lots.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Main Lot")).toBeInTheDocument();
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it("navigates to lot detail when clicking 'View details'", async () => {
    vi.spyOn(lotApi, "list").mockResolvedValue(mockLots);
    vi.spyOn(lotApi, "get").mockResolvedValue(mockLotDetail);

    renderPage();
    const user = userEvent.setup();

    const viewButton = await screen.findByRole("button", {
      name: "View details for Main Lot",
    });
    await user.click(viewButton);

    expect(await screen.findByTestId("spot-A1")).toBeInTheDocument();
    expect(screen.getByTestId("spot-A2")).toBeInTheDocument();
    expect(screen.getByTestId("spot-A3")).toBeInTheDocument();
    expect(screen.getByTestId("spot-A4")).toBeInTheDocument();

    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("Total capacity")).toBeInTheDocument();
  });

  it("filters spots by status in lot detail view", async () => {
    vi.spyOn(lotApi, "list").mockResolvedValue(mockLots);
    vi.spyOn(lotApi, "get").mockResolvedValue(mockLotDetail);

    renderPage();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: "View details for Main Lot" }),
    );
    expect(await screen.findByTestId("spot-A1")).toBeInTheDocument();

    // Filter by Available
    await user.click(screen.getByRole("button", { name: /^Available/ }));
    expect(screen.getByTestId("spot-A1")).toBeInTheDocument();
    expect(screen.getByTestId("spot-A2")).toBeInTheDocument();
    expect(screen.queryByTestId("spot-A3")).not.toBeInTheDocument();
    expect(screen.queryByTestId("spot-A4")).not.toBeInTheDocument();

    // Filter by Occupied
    await user.click(screen.getByRole("button", { name: /^Occupied/ }));
    expect(screen.queryByTestId("spot-A1")).not.toBeInTheDocument();
    expect(screen.getByTestId("spot-A3")).toBeInTheDocument();

    // Filter by All
    await user.click(screen.getByRole("button", { name: /^All/ }));
    expect(screen.getByTestId("spot-A1")).toBeInTheDocument();
    expect(screen.getByTestId("spot-A3")).toBeInTheDocument();
  });

  it("handles error in lot detail and allows retry", async () => {
    vi.spyOn(lotApi, "list").mockResolvedValue(mockLots);
    const getSpy = vi
      .spyOn(lotApi, "get")
      .mockRejectedValueOnce(
        new ApiError("Failed to load parking lot details.", 500),
      )
      .mockResolvedValueOnce(mockLotDetail);

    renderPage();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: "View details for Main Lot" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load parking lot details.",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByTestId("spot-A1")).toBeInTheDocument();
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it("shows message when lot has no spots", async () => {
    vi.spyOn(lotApi, "list").mockResolvedValue(mockLots);
    vi.spyOn(lotApi, "get").mockResolvedValue({
      ...mockLotDetail,
      spots: [],
    });

    renderPage();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: "View details for Main Lot" }),
    );

    expect(
      await screen.findByText("No spots found in this parking lot."),
    ).toBeInTheDocument();
  });

  it("navigates back to the lots list view", async () => {
    vi.spyOn(lotApi, "list").mockResolvedValue(mockLots);
    vi.spyOn(lotApi, "get").mockResolvedValue(mockLotDetail);

    renderPage();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: "View details for Main Lot" }),
    );
    expect(await screen.findByTestId("spot-A1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to all lots" }));

    expect(await screen.findByText("North Lot")).toBeInTheDocument();
    expect(screen.queryByTestId("spot-A1")).not.toBeInTheDocument();
  });
});
