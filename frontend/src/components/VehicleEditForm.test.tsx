import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "../api/client";
import { vehicleApi } from "../api/vehicleApi";
import type { Vehicle } from "../types/vehicle";
import VehicleEditForm from "./VehicleEditForm";

const vehicle: Vehicle = {
  id: "abc",
  userId: "user-1",
  licensePlate: "1AB2345",
  brand: "Škoda",
  model: "Octavia",
  engineType: "combustion",
  size: "standard",
};

function renderForm() {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  render(
    <VehicleEditForm vehicle={vehicle} onSaved={onSaved} onCancel={onCancel} />,
  );
  return { onSaved, onCancel };
}

describe("VehicleEditForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is prefilled with the vehicle's current data", () => {
    renderForm();

    expect(screen.getByLabelText("License plate")).toHaveValue("1AB2345");
    expect(screen.getByLabelText("Brand")).toHaveValue("Škoda");
    expect(screen.getByLabelText("Model")).toHaveValue("Octavia");
    expect(screen.getByLabelText("Engine type")).toHaveValue("combustion");
    expect(screen.getByLabelText("Size")).toHaveValue("standard");
  });

  it("saves the changes and reports the saved vehicle", async () => {
    const saved = { ...vehicle, model: "Enyaq", engineType: "electric" };
    const update = vi
      .spyOn(vehicleApi, "update")
      .mockResolvedValue(saved as Vehicle);
    const { onSaved } = renderForm();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Model"));
    await user.type(screen.getByLabelText("Model"), "Enyaq");
    await user.selectOptions(screen.getByLabelText("Engine type"), "electric");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(update).toHaveBeenCalledWith("abc", {
      licensePlate: "1AB2345",
      brand: "Škoda",
      model: "Enyaq",
      engineType: "electric",
      size: "standard",
    });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("disables the buttons while saving", async () => {
    vi.spyOn(vehicleApi, "update").mockReturnValue(new Promise(() => {}));
    renderForm();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("shows the error and stays open when saving fails", async () => {
    vi.spyOn(vehicleApi, "update").mockRejectedValue(
      new ApiError("Plate already registered", 409),
    );
    const { onSaved } = renderForm();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Plate already registered",
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("does not save a plate with special characters", async () => {
    const update = vi.spyOn(vehicleApi, "update");
    renderForm();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("License plate"));
    await user.type(screen.getByLabelText("License plate"), "1AB_2345");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "License plate must be 2–12 letters or digits",
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("does not save a plate with more than 12 characters", async () => {
    const update = vi.spyOn(vehicleApi, "update");
    renderForm();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("License plate"));
    await user.type(screen.getByLabelText("License plate"), "ABCDEFGH12345");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "License plate must be 2–12 letters or digits",
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("calls onCancel when cancelled", async () => {
    const { onCancel } = renderForm();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
  });
});
