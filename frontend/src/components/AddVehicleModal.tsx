import { useState, type FormEvent } from "react";
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

type AddVehicleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (vehicle: Vehicle) => void;
};

export default function AddVehicleModal({
  isOpen,
  onClose,
  onAdded,
}: AddVehicleModalProps) {
  const [values, setValues] = useState<VehicleInput>({
    licensePlate: "",
    brand: "",
    model: "",
    engineType: "combustion",
    size: "standard",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function setField<K extends keyof VehicleInput>(
    field: K,
    value: VehicleInput[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidLicensePlate(values.licensePlate)) {
      setError(
        `License plate must be ${LICENSE_PLATE_MIN_LENGTH}–${LICENSE_PLATE_MAX_LENGTH} letters or digits (spaces and hyphens are ignored).`,
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await vehicleApi.create(values);
      onAdded(created);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Adding vehicle failed. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-vehicle-title"
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="add-vehicle-title" className="modal-title">
            Add a vehicle
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div role="alert" className="session-error">
                <p className="session-error__message">{error}</p>
              </div>
            )}

            <div className="modal-field">
              <label htmlFor="vehicle-plate" className="modal-field__label">
                License plate
              </label>
              <input
                id="vehicle-plate"
                type="text"
                className="modal-input"
                placeholder="2AC 5678"
                value={values.licensePlate}
                onChange={(e) => setField("licensePlate", e.target.value)}
                maxLength={LICENSE_PLATE_MAX_LENGTH * 2}
                required
              />
            </div>

            <div className="modal-field">
              <label htmlFor="vehicle-brand" className="modal-field__label">
                Brand
              </label>
              <input
                id="vehicle-brand"
                type="text"
                className="modal-input"
                placeholder="Tesla"
                value={values.brand}
                onChange={(e) => setField("brand", e.target.value)}
                required
              />
            </div>

            <div className="modal-field">
              <label htmlFor="vehicle-model" className="modal-field__label">
                Model
              </label>
              <input
                id="vehicle-model"
                type="text"
                className="modal-input"
                placeholder="Model 3"
                value={values.model}
                onChange={(e) => setField("model", e.target.value)}
                required
              />
            </div>

            <div className="modal-field">
              <label htmlFor="vehicle-engine" className="modal-field__label">
                Engine type
              </label>
              <select
                id="vehicle-engine"
                className="modal-input"
                value={values.engineType}
                onChange={(e) =>
                  setField("engineType", e.target.value as EngineType)
                }
              >
                <option value="combustion">Combustion</option>
                <option value="electric">Electric</option>
              </select>
            </div>

            <div className="modal-field">
              <label htmlFor="vehicle-size" className="modal-field__label">
                Size
              </label>
              <select
                id="vehicle-size"
                className="modal-input"
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

          <div className="modal-footer modal-footer--two-buttons">
            <button
              type="button"
              className="btn-action-ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-action-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Add vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
