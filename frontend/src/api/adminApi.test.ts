import { describe, expect, it, vi } from "vitest";
import { adminApi } from "./adminApi";
import { apiClient } from "./client";

describe("adminApi", () => {
  it("calls GET /lots", async () => {
    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue([]);
    await adminApi.listLots();
    expect(getSpy).toHaveBeenCalledWith("/lots");
  });

  it("calls GET /admin/spots with and without lotId", async () => {
    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({ spots: [] });
    await adminApi.listSpots();
    expect(getSpy).toHaveBeenCalledWith("/admin/spots");

    await adminApi.listSpots("lot-1");
    expect(getSpy).toHaveBeenCalledWith("/admin/spots?lotId=lot-1");
  });

  it("calls POST /admin/spots to create spot", async () => {
    const postSpy = vi.spyOn(apiClient, "post").mockResolvedValue({
      spot: {
        id: "s1",
        spotNumber: "A-01",
        lotId: "lot-1",
        type: "standard",
        size: "standard",
        status: "free",
      },
    });

    const input = {
      spotNumber: "A-01",
      lotId: "lot-1",
      type: "standard" as const,
      size: "standard" as const,
      status: "free" as const,
    };
    await adminApi.createSpot(input);
    expect(postSpy).toHaveBeenCalledWith("/admin/spots", input);
  });

  it("calls GET /admin/audit-logs", async () => {
    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({ logs: [] });
    await adminApi.listAuditLogs();
    expect(getSpy).toHaveBeenCalledWith("/admin/audit-logs");
  });
});
