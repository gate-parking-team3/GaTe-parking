import { isValidLicensePlate } from "./vehicle";

describe("isValidLicensePlate", () => {
  it.each(["A", "1AB2345", "abc123", "ABCDEFGH1234"])("accepts %s", (plate) => {
    expect(isValidLicensePlate(plate)).toBe(true);
  });

  it.each([
    ["an empty plate", ""],
    ["more than 12 characters", "ABCDEFGH12345"],
    ["a space", "1AB 2345"],
    ["a dash", "1AB-2345"],
    ["an accented letter", "1ČB2345"],
  ])("rejects %s", (_case, plate) => {
    expect(isValidLicensePlate(plate)).toBe(false);
  });
});
