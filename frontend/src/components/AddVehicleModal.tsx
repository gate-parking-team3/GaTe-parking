import { useState, type FormEvent, type KeyboardEvent } from "react";
import { vehicleApi } from "../api/vehicleApi";
import {
  isValidLicensePlate,
  LICENSE_PLATE_MAX_LENGTH,
  LICENSE_PLATE_MIN_LENGTH,
  type EngineType,
  type Vehicle,
  type VehicleInput,
  type VehicleSize,
} from "../types/vehicle";
import Icon from "./Icon";

type AddVehicleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (vehicle: Vehicle) => void;
};

const emptyVehicle: VehicleInput = {
  licensePlate: "",
  brand: "",
  model: "",
  engineType: "combustion",
  size: "standard",
};

export default function AddVehicleModal({
  isOpen,
  onClose,
  onAdded,
}: AddVehicleModalProps) {
  const [values, setValues] = useState<VehicleInput>(emptyVehicle);
  const [saving, setSaving] = useState(false);
  const [plateError, setPlateError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function setField<K extends keyof VehicleInput>(
    field: K,
    value: VehicleInput[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function close() {
    setValues(emptyVehicle);
    setPlateError(null);
    setError(null);
    onClose();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !saving) close();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isValidLicensePlate(values.licensePlate)) {
      setPlateError(
        `Use ${LICENSE_PLATE_MIN_LENGTH}–${LICENSE_PLATE_MAX_LENGTH} letters or digits. Spaces and hyphens are ignored.`,
      );
      return;
    }
    setPlateError(null);
    setSaving(true);
    try {
      const created = await vehicleApi.create(values);
      onAdded(created);
      close();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Adding the vehicle failed. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    // The backdrop only forwards Escape and outside clicks; the dialog itself is focusable content.
    <div
      className="backdrop"
      onClick={() => !saving && close()}
      onKeyDown={handleKeyDown}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-vehicle-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-h">
          <h2 id="add-vehicle-title">Add a vehicle</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={close}
            disabled={saving}
            aria-label="Close"
          >
            <Icon name="x" small />
          </button>
        </div>

        <form className="form" onSubmit={handleSubmit} noValidate>
          <div className="modal-b">
            {error && (
              <div role="alert" className="err">
                {error}
              </div>
            )}

            <div className="field">
              <label htmlFor="vehicle-plate">License plate</label>
              <input
                id="vehicle-plate"
                className="input"
                type="text"
                autoFocus
                autoComplete="off"
                placeholder="2AC 5678"
                value={values.licensePlate}
                onChange={(e) => setField("licensePlate", e.target.value)}
                maxLength={LICENSE_PLATE_MAX_LENGTH * 2}
                aria-invalid={plateError ? true : undefined}
                aria-describedby="vehicle-plate-note"
                required
              />
              {plateError ? (
                <span id="vehicle-plate-note" className="field-err">
                  {plateError}
                </span>
              ) : (
                <span id="vehicle-plate-note" className="hint">
                  The gate opens for this plate. For example 1AB 2345.
                </span>
              )}
            </div>

            <div className="row">
              <div className="field">
                <label htmlFor="vehicle-brand">Brand</label>
                <input
                  id="vehicle-brand"
                  className="input"
                  type="text"
                  placeholder="Tesla"
                  value={values.brand}
                  onChange={(e) => setField("brand", e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="vehicle-model">Model</label>
                <input
                  id="vehicle-model"
                  className="input"
                  type="text"
                  placeholder="Model 3"
                  value={values.model}
                  onChange={(e) => setField("model", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label htmlFor="vehicle-engine">Engine type</label>
                <select
                  id="vehicle-engine"
                  className="select"
                  value={values.engineType}
                  onChange={(e) =>
                    setField("engineType", e.target.value as EngineType)
                  }
                >
                  <option value="combustion">Combustion</option>
                  <option value="electric">Electric</option>
                </select>
                {values.engineType === "electric" && (
                  <span className="hint">
                    Electric vehicles can use EV spots.
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="vehicle-size">Size</label>
                <select
                  id="vehicle-size"
                  className="select"
                  value={values.size}
                  onChange={(e) =>
                    setField("size", e.target.value as VehicleSize)
                  }
                >
                  <option value="small">Small</option>
                  <option value="standard">Standard</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </div>
          </div>

          <div className="modal-f">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={close}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Add vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
