import { useEffect, useState } from "react";
import { vehicleApi } from "../api/vehicleApi";
import type { EngineType, Vehicle, VehicleSize } from "../types/vehicle";
import VehicleEditForm from "./VehicleEditForm";

const engineLabels: Record<EngineType, string> = {
  combustion: "Combustion",
  "plug-in": "Plug-in",
};

const sizeLabels: Record<VehicleSize, string> = {
  small: "Small",
  standard: "Standard",
  large: "Large",
};

export default function VehicleList() {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let ignore = false;
    vehicleApi.list().then(
      (list) => {
        if (!ignore) setVehicles(list);
      },
      (err: unknown) => {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Loading failed. Please try again.",
          );
        }
      },
    );
    return () => {
      ignore = true;
    };
  }, [reloadCount]);

  function retry() {
    setError(null);
    setReloadCount((count) => count + 1);
  }

  function handleSaved(saved: Vehicle) {
    setVehicles(
      (current) =>
        current?.map((vehicle) =>
          vehicle.id === saved.id ? saved : vehicle,
        ) ?? null,
    );
    setEditing(null);
  }

  if (editing) {
    return (
      <VehicleEditForm
        vehicle={editing}
        onSaved={handleSaved}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <section>
      <h2>My vehicles</h2>

      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      ) : vehicles === null ? (
        <p>Loading vehicles…</p>
      ) : vehicles.length === 0 ? (
        <p>You have no vehicles yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>License plate</th>
              <th>Brand</th>
              <th>Model</th>
              <th>Engine type</th>
              <th>Size</th>
              <th>
                <span hidden>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id}>
                <td>{vehicle.licensePlate}</td>
                <td>{vehicle.brand}</td>
                <td>{vehicle.model}</td>
                <td>{engineLabels[vehicle.engineType]}</td>
                <td>{sizeLabels[vehicle.size]}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => setEditing(vehicle)}
                    aria-label={`Edit ${vehicle.licensePlate}`}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
