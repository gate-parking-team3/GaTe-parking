import { apiClient } from "./client";
import { lotApi } from "./lotApi";

describe("lotApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists all parking lots", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue([]);

    await lotApi.list();
    expect(get).toHaveBeenCalledWith("/lots");
  });

  it("gets a single parking lot with spots", async () => {
    const mockDetail = {
      id: "lot-1",
      name: "Main lot",
      address: "Main Street 1",
      totalCapacity: 4,
      evCapacity: 1,
      disabledCapacity: 1,
      availability: {
        total: 4,
        available: 4,
        occupied: 0,
        reserved: 0,
      },
      spots: [],
    };
    const get = vi.spyOn(apiClient, "get").mockResolvedValue(mockDetail);

    const result = await lotApi.get("lot-1");
    expect(get).toHaveBeenCalledWith("/lots/lot-1");
    expect(result).toEqual(mockDetail);
  });
});
