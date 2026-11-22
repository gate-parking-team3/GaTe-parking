import { describe, expect, it } from "vitest";
import {
  parseTimeWindow,
  spotSuitsVehicle,
  windowsOverlap,
} from "./reservation.rules.js";

const now = new Date("2026-11-10T08:00:00Z");
const at = (time: string) => new Date(`2026-11-10T${time}:00Z`);
const noDisabled = { disabledAllowed: false };

describe("spotSuitsVehicle", () => {
  const combustion = { engineType: "combustion", size: "standard" } as const;
  const electric = { engineType: "electric", size: "standard" } as const;

  it("gives combustion cars standard spots only", () => {
    expect(
      spotSuitsVehicle(
        { type: "standard", size: "standard" },
        combustion,
        noDisabled,
      ),
    ).toBe(true);
    expect(
      spotSuitsVehicle(
        { type: "ev", size: "standard" },
        combustion,
        noDisabled,
      ),
    ).toBe(false);
    expect(
      spotSuitsVehicle(
        { type: "disabled", size: "standard" },
        combustion,
        noDisabled,
      ),
    ).toBe(false);
  });

  it("offers disabled spots only when entitled", () => {
    expect(
      spotSuitsVehicle({ type: "disabled", size: "large" }, combustion, {
        disabledAllowed: true,
      }),
    ).toBe(true);
  });

  it("gives electric cars EV and standard spots, and only EV with the filter", () => {
    expect(
      spotSuitsVehicle({ type: "ev", size: "standard" }, electric, noDisabled),
    ).toBe(true);
    expect(
      spotSuitsVehicle(
        { type: "standard", size: "standard" },
        electric,
        noDisabled,
      ),
    ).toBe(true);
    expect(
      spotSuitsVehicle({ type: "standard", size: "standard" }, electric, {
        disabledAllowed: false,
        evOnly: true,
      }),
    ).toBe(false);
  });

  it("fits a vehicle into a spot of its size or larger", () => {
    const spot = (size: "small" | "standard" | "large") =>
      spotSuitsVehicle({ type: "standard", size }, combustion, noDisabled);
    expect(spot("small")).toBe(false);
    expect(spot("standard")).toBe(true);
    expect(spot("large")).toBe(true);
  });
});

describe("windowsOverlap", () => {
  it("treats touching windows as free", () => {
    const morning = { start: at("08:00"), end: at("10:00") };
    expect(
      windowsOverlap(morning, { start: at("10:00"), end: at("12:00") }),
    ).toBe(false);
    expect(
      windowsOverlap(morning, { start: at("09:59"), end: at("12:00") }),
    ).toBe(true);
    expect(
      windowsOverlap(morning, { start: at("07:00"), end: at("13:00") }),
    ).toBe(true);
  });
});

describe("parseTimeWindow", () => {
  it("accepts a future window", () => {
    expect(
      parseTimeWindow("2026-11-10T09:00:00Z", "2026-11-10T11:00:00Z", now),
    ).toEqual({ ok: true, value: { start: at("09:00"), end: at("11:00") } });
  });

  it("allows a start a few minutes in the past", () => {
    expect(
      parseTimeWindow("2026-11-10T07:57:00Z", "2026-11-10T09:00:00Z", now).ok,
    ).toBe(true);
  });

  it.each([
    [undefined, "2026-11-10T11:00:00Z", "Start and end must be ISO date-times"],
    [
      "tomorrow",
      "2026-11-10T11:00:00Z",
      "Start and end must be ISO date-times",
    ],
    ["2026-11-10T11:00:00Z", "2026-11-10T11:00:00Z", "End must be after start"],
    ["2026-11-10T11:00:00Z", "2026-11-10T09:00:00Z", "End must be after start"],
    [
      "2026-11-10T07:00:00Z",
      "2026-11-10T09:00:00Z",
      "Start cannot be in the past",
    ],
  ])("rejects start=%s end=%s", (start, end, error) => {
    expect(parseTimeWindow(start, end, now)).toEqual({ ok: false, error });
  });
});
