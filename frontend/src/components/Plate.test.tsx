import { render, screen } from "@testing-library/react";
import Plate, { formatPlate } from "./Plate";

describe("formatPlate", () => {
  it("puts a space after the first three characters of a 7-character plate", () => {
    expect(formatPlate("1AB2345")).toBe("1AB 2345");
    expect(formatPlate("1AB 2345")).toBe("1AB 2345");
    expect(formatPlate("1AB-2345")).toBe("1AB 2345");
  });

  it("leaves other lengths as typed", () => {
    expect(formatPlate("AB123")).toBe("AB123");
  });
});

describe("Plate", () => {
  it("shows the CZ badge and the formatted plate", () => {
    render(<Plate plate="1AB2345" />);

    expect(screen.getByText("CZ")).toBeInTheDocument();
    expect(screen.getByText("1AB 2345")).toBeInTheDocument();
  });
});
