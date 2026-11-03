import type { VehicleInput } from "../types/vehicle";
import { apiClient } from "./client";
import { vehicleApi } from "./vehicleApi";

const input: VehicleInput = {
  licensePlate: "1AB2345",
  brand: "Škoda",
  model: "Octavia",
  engineType: "electric",
  size: "standard",
};

describe("vehicleApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists vehicles", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue([]);

    await vehicleApi.list();
    expect(get).toHaveBeenCalledWith("/vehicles");
  });

  it("gets one vehicle", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({});

    await vehicleApi.get("abc");
    expect(get).toHaveBeenCalledWith("/vehicles/abc");
  });

  it("creates a vehicle", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({});

    await vehicleApi.create(input);
    expect(post).toHaveBeenCalledWith("/vehicles", input);
  });

  it("updates a vehicle", async () => {
    const put = vi.spyOn(apiClient, "put").mockResolvedValue({});

    await vehicleApi.update("abc", input);
    expect(put).toHaveBeenCalledWith("/vehicles/abc", input);
  });

  it("removes a vehicle", async () => {
    const remove = vi.spyOn(apiClient, "delete").mockResolvedValue(undefined);

    await vehicleApi.remove("abc");
    expect(remove).toHaveBeenCalledWith("/vehicles/abc");
  });

  it("escapes the id in the address", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({});

    await vehicleApi.get("a/b");
    expect(get).toHaveBeenCalledWith("/vehicles/a%2Fb");
  });
});
