import { isEditableReservation, type Reservation } from "./reservation";

const now = new Date("2026-11-10T08:00:00.000Z");

const reservation: Reservation = {
  id: "abc",
  userId: "user-1",
  vehicleId: "car-1",
  spotId: "spot-1",
  lotId: "lot-1",
  status: "reserved",
  startTime: "2026-11-10T09:00:00.000Z",
  endTime: "2026-11-10T11:00:00.000Z",
};

describe("isEditableReservation", () => {
  it("allows a reserved booking that has not started", () => {
    expect(isEditableReservation(reservation, now)).toBe(true);
  });

  it("refuses a booking whose start has passed", () => {
    expect(
      isEditableReservation(
        { ...reservation, startTime: "2026-11-10T07:59:00.000Z" },
        now,
      ),
    ).toBe(false);
  });

  it.each(["active", "completed", "cancelled"] as const)(
    "refuses a %s booking",
    (status) => {
      expect(isEditableReservation({ ...reservation, status }, now)).toBe(
        false,
      );
    },
  );
});
