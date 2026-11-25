import { describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { notificationApi } from "./notificationApi";

describe("notificationApi", () => {
  it("lists notifications", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue([]);
    await notificationApi.list();
    expect(get).toHaveBeenCalledWith("/notifications");
  });

  it("marks a notification as read", async () => {
    const patch = vi.spyOn(apiClient, "patch").mockResolvedValue(undefined);
    await notificationApi.markRead("123");
    expect(patch).toHaveBeenCalledWith("/notifications/123/read", undefined);
  });

  it("gets notification settings", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({
      start_soon: true,
      end_soon: true,
      cancelled: true,
      deleted: true,
      spot_unavailable: true,
    });
    await notificationApi.settings();
    expect(get).toHaveBeenCalledWith("/notifications/settings");
  });

  it("updates notification settings", async () => {
    const patch = vi.spyOn(apiClient, "patch").mockResolvedValue({
      start_soon: false,
      end_soon: true,
      cancelled: true,
      deleted: true,
      spot_unavailable: true,
    });
    await notificationApi.updateSettings({ start_soon: false });
    expect(patch).toHaveBeenCalledWith("/notifications/settings", {
      start_soon: false,
    });
  });
});
