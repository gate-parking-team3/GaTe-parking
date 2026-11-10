import { apiClient } from "./client";
import { reservationApi } from "./reservationApi";

describe("reservationApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists the user's reservations", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue([]);

    await reservationApi.mine();
    expect(get).toHaveBeenCalledWith("/reservations/mine");
  });

  it("gets one reservation", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({});

    await reservationApi.get("abc");
    expect(get).toHaveBeenCalledWith("/reservations/abc");
  });

  it("sends only the changed fields with PATCH", async () => {
    const patch = vi.spyOn(apiClient, "patch").mockResolvedValue({});

    await reservationApi.update("abc", { spotId: "spot-2" });
    expect(patch).toHaveBeenCalledWith("/reservations/abc", {
      spotId: "spot-2",
    });
  });

  it("asks for free spots in a lot and returns them", async () => {
    const spots = [{ id: "spot-2" }];
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ spots });

    await expect(
      reservationApi.availableSpots("lot-1", {
        vehicleId: "car-1",
        start: "2099-01-10T09:00:00.000Z",
        end: "2099-01-10T11:00:00.000Z",
      }),
    ).resolves.toEqual(spots);
    expect(get).toHaveBeenCalledWith(
      "/lots/lot-1/available-spots?vehicleId=car-1&start=2099-01-10T09%3A00%3A00.000Z&end=2099-01-10T11%3A00%3A00.000Z",
    );
  });
});
