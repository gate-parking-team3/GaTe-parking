import { isValidLicensePlate } from "./vehicle";

describe("isValidLicensePlate", () => {
  it.each(["AB", "1AB2345", "abc123", "ABCDEFGH1234", "1AB 2345", "1AB-2345"])(
    "accepts %s",
    (plate) => {
      expect(isValidLicensePlate(plate)).toBe(true);
    },
  );

  it.each([
    ["an empty plate", ""],
    ["a single character", "A"],
    ["only spaces and dashes", " - "],
    ["more than 12 characters", "ABCDEFGH12345"],
    ["a special character", "1AB_2345"],
    ["an accented letter", "1ČB2345"],
  ])("rejects %s", (_case, plate) => {
    expect(isValidLicensePlate(plate)).toBe(false);
  });
});
