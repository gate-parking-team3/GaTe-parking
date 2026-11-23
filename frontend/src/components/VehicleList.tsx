import { useEffect, useState } from "react";
import { vehicleApi } from "../api/vehicleApi";
import type { EngineType, Vehicle, VehicleSize } from "../types/vehicle";
import VehicleEditForm from "./VehicleEditForm";

const engineLabels: Record<EngineType, string> = {
  combustion: "Combustion",
  electric: "Electric",
};

const sizeLabels: Record<VehicleSize, string> = {
  small: "Small",
  standard: "Standard",
  large: "Large",
};

export default function VehicleList({
  refreshTrigger,
}: {
  refreshTrigger?: number;
} = {}) {
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
  }, [reloadCount, refreshTrigger]);

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
    <section aria-label="Vehicles" className="vehicles-section">
      {error ? (
        <div role="alert" className="session-error">
          <p className="session-error__message">{error}</p>
          <button
            type="button"
            className="session-error__retry"
            onClick={retry}
          >
            Try again
          </button>
        </div>
      ) : vehicles === null ? (
        <p className="parking-loading-msg">Loading vehicles…</p>
      ) : vehicles.length === 0 ? (
        <p className="parking-empty-msg">You have no vehicles yet.</p>
      ) : (
        <div className="vehicles-list">
          {vehicles.map((vehicle) => (
            <article
              key={vehicle.id}
              className="vehicle-row"
              onClick={() => setEditing(vehicle)}
            >
              <div className="vehicle-row__left">
                <div
                  className="cz-plate"
                  aria-label={`CZ ${vehicle.licensePlate}`}
                >
                  <span className="cz-plate__flag">CZ</span>
                  <span className="cz-plate__code">{vehicle.licensePlate}</span>
                </div>

                <div className="vehicle-row__info">
                  <h3 className="vehicle-row__title">
                    <span className="vehicle-row__brand">{vehicle.brand}</span>{" "}
                    <span className="vehicle-row__model">{vehicle.model}</span>
                  </h3>

                  <div className="vehicle-row__meta">
                    <span
                      className={`vehicle-row__engine ${vehicle.engineType === "electric" ? "vehicle-row__engine--electric" : ""}`}
                    >
                      {vehicle.engineType === "electric" && (
                        <span aria-hidden="true">⚡ </span>
                      )}
                      <span>{engineLabels[vehicle.engineType]}</span>
                    </span>
                    <span className="vehicle-row__meta-sep" aria-hidden="true">
                      {" "}
                      ·{" "}
                    </span>
                    <span className="vehicle-row__ev-hint">
                      {vehicle.engineType === "electric"
                        ? "can use EV spots"
                        : "standard spots only"}
                    </span>
                    <span className="vehicle-row__meta-sep" aria-hidden="true">
                      {" "}
                      ·{" "}
                    </span>
                    <span className="vehicle-row__size">
                      <span>{sizeLabels[vehicle.size]}</span> size
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="vehicle-row__action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(vehicle);
                }}
                aria-label={`Edit ${vehicle.licensePlate}`}
              >
                <span className="sr-only">Edit</span>
                <span className="vehicle-row__chevron" aria-hidden="true">
                  &rsaquo;
                </span>
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
