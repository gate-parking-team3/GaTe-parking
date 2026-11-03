import { ApiError, apiClient, setToken } from "./client";

function mockFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("apiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the JSON body of a successful request", async () => {
    const fetchMock = mockFetch(200, [{ id: "1" }]);

    await expect(apiClient.get("/vehicles")).resolves.toEqual([{ id: "1" }]);
    expect(fetchMock).toHaveBeenCalledWith("/api/vehicles", {
      method: "GET",
      headers: {},
      body: undefined,
    });
  });

  it("sends the body as JSON", async () => {
    const fetchMock = mockFetch(201, { id: "1" });

    await apiClient.post("/vehicles", { brand: "Škoda" });
    expect(fetchMock).toHaveBeenCalledWith("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: "Škoda" }),
    });
  });

  it("sends the sign-in token when there is one", async () => {
    const fetchMock = mockFetch(200, []);
    setToken("abc");

    await apiClient.get("/vehicles");
    expect(fetchMock).toHaveBeenCalledWith("/api/vehicles", {
      method: "GET",
      headers: { Authorization: "Bearer abc" },
      body: undefined,
    });
    setToken(null);
  });

  it("returns nothing for an empty response", async () => {
    mockFetch(204);

    await expect(apiClient.delete("/vehicles/1")).resolves.toBeUndefined();
  });

  it("throws the server's error message", async () => {
    mockFetch(409, { error: "Plate already registered" });

    await expect(apiClient.put("/vehicles/1", {})).rejects.toEqual(
      new ApiError("Plate already registered", 409),
    );
  });

  it("throws a generic error when the server sends no message", async () => {
    mockFetch(500);

    await expect(apiClient.get("/vehicles")).rejects.toThrow(
      "Request failed with status 500",
    );
  });

  it("throws a network error when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError()));

    await expect(apiClient.get("/vehicles")).rejects.toMatchObject({
      status: 0,
    });
  });
});
