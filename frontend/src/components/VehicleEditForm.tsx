import { useState, type FormEvent } from "react";
import { vehicleApi } from "../api/vehicleApi";
import type {
  EngineType,
  Vehicle,
  VehicleInput,
  VehicleSize,
} from "../types/vehicle";

type VehicleEditFormProps = {
  vehicle: Vehicle;
  onSaved: (vehicle: Vehicle) => void;
  onCancel: () => void;
};

export default function VehicleEditForm({
  vehicle,
  onSaved,
  onCancel,
}: VehicleEditFormProps) {
  const { id, ...initialValues } = vehicle;
  const [values, setValues] = useState<VehicleInput>(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof VehicleInput>(
    field: K,
    value: VehicleInput[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(await vehicleApi.update(id, values));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Saving failed. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Edit vehicle</h2>

      <label>
        License plate
        <input
          value={values.licensePlate}
          onChange={(event) => setField("licensePlate", event.target.value)}
          required
        />
      </label>

      <label>
        Brand
        <input
          value={values.brand}
          onChange={(event) => setField("brand", event.target.value)}
          required
        />
      </label>

      <label>
        Model
        <input
          value={values.model}
          onChange={(event) => setField("model", event.target.value)}
          required
        />
      </label>

      <label>
        Engine type
        <select
          value={values.engineType}
          onChange={(event) =>
            setField("engineType", event.target.value as EngineType)
          }
        >
          <option value="combustion">Combustion</option>
          <option value="electric">Electric</option>
        </select>
      </label>

      <label>
        Size
        <select
          value={values.size}
          onChange={(event) =>
            setField("size", event.target.value as VehicleSize)
          }
        >
          <option value="small">Small</option>
          <option value="standard">Standard</option>
          <option value="large">Large</option>
        </select>
      </label>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
    </form>
  );
}
