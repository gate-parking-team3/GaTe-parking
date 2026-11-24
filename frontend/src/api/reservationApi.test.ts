import { apiClient } from "./client";
import { reservationApi } from "./reservationApi";

describe("reservationApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists the parking lots", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue([]);

    await reservationApi.lots();
    expect(get).toHaveBeenCalledWith("/lots");
  });

  it("creates a reservation with POST", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({});
    const input = {
      vehicleId: "car-1",
      spotId: "spot-1",
      startTime: "2099-01-10T09:00:00.000Z",
      endTime: "2099-01-10T11:00:00.000Z",
    };

    await reservationApi.create(input);
    expect(post).toHaveBeenCalledWith("/reservations", input);
  });

  it("lists the user's reservations", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue([]);

    await reservationApi.mine();
    expect(get).toHaveBeenCalledWith("/reservations/mine");
  });

  it("lists the user's upcoming and current reservations", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue([]);

    await reservationApi.current();
    expect(get).toHaveBeenCalledWith("/reservations/active");
  });

  it("deletes a reservation", async () => {
    const del = vi.spyOn(apiClient, "delete").mockResolvedValue(undefined);

    await reservationApi.remove("abc");
    expect(del).toHaveBeenCalledWith("/reservations/abc");
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

  it("adds the EV-only filter when asked", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ spots: [] });

    await reservationApi.availableSpots("lot-1", {
      vehicleId: "car-2",
      start: "2099-01-10T09:00:00.000Z",
      end: "2099-01-10T11:00:00.000Z",
      evOnly: true,
    });
    expect(get).toHaveBeenCalledWith(
      "/lots/lot-1/available-spots?vehicleId=car-2&start=2099-01-10T09%3A00%3A00.000Z&end=2099-01-10T11%3A00%3A00.000Z&evOnly=true",
    );
  });
});
