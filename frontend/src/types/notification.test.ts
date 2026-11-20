import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
} from "./notification";

describe("Notification types and constants", () => {
  it("defines all 5 notification types", () => {
    expect(NOTIFICATION_TYPES).toEqual([
      "start_soon",
      "end_soon",
      "cancelled",
      "deleted",
      "spot_unavailable",
    ]);
  });

  it("enables all notification types by default", () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS).toEqual({
      start_soon: true,
      end_soon: true,
      cancelled: true,
      deleted: true,
      spot_unavailable: true,
    });
  });

  it("provides readable labels for every notification type", () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(NOTIFICATION_TYPE_LABELS[type]).toBeDefined();
      expect(NOTIFICATION_TYPE_LABELS[type].length).toBeGreaterThan(0);
    }
  });
});
