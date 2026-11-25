import { useEffect, useState } from "react";
import { vehicleApi } from "../api/vehicleApi";
import type { Vehicle, VehicleSize } from "../types/vehicle";
import Icon from "./Icon";
import Plate from "./Plate";
import VehicleEditForm from "./VehicleEditForm";

const sizeLabels: Record<VehicleSize, string> = {
  small: "Small",
  standard: "Standard",
  large: "Large",
};

export default function VehicleList({
  refreshTrigger = 0,
}: {
  refreshTrigger?: number;
}) {
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
    <section aria-label="Vehicles">
      {error ? (
        <div role="alert" className="err">
          <p>{error}</p>
          <button type="button" className="btn btn-sm" onClick={retry}>
            Try again
          </button>
        </div>
      ) : vehicles === null ? (
        <p className="muted">Loading vehicles…</p>
      ) : vehicles.length === 0 ? (
        <div className="empty">
          <h3>No vehicles yet</h3>
          <p>You have no vehicles yet. Add one to book a spot.</p>
        </div>
      ) : (
        <div className="card">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="item click"
              role="button"
              tabIndex={0}
              aria-label={`Edit ${vehicle.licensePlate}`}
              onClick={() => setEditing(vehicle)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setEditing(vehicle);
                }
              }}
            >
              <Plate plate={vehicle.licensePlate} />
              <div className="grow">
                <div className="item-t">
                  {vehicle.brand} {vehicle.model}
                </div>
                <div className="item-s">
                  {vehicle.engineType === "electric" ? (
                    <>
                      <span className="ev">
                        <Icon name="bolt" />
                        Electric
                      </span>
                      · can use EV spots
                    </>
                  ) : (
                    "Petrol / diesel"
                  )}{" "}
                  · {sizeLabels[vehicle.size].toLowerCase()} size
                </div>
              </div>
              <span className="faint" aria-hidden="true">
                <Icon name="chev" small />
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
