import { useEffect, useState, type FormEvent } from "react";
import { reservationApi } from "../api/reservationApi";
import { vehicleApi } from "../api/vehicleApi";
import {
  isEditableReservation,
  type ParkingSpot,
  type ParkingSpotType,
  type Reservation,
  type ReservationUpdate,
} from "../types/reservation";
import type { Vehicle } from "../types/vehicle";

type ReservationEditFormProps = {
  reservation: Reservation;
  onSaved: (reservation: Reservation) => void;
  onCancel: () => void;
};

const spotTypeLabels: Record<ParkingSpotType, string> = {
  standard: "Standard",
  disabled: "Disabled",
  ev: "EV",
};

// <input type="datetime-local"> shows local time without a time zone; the API uses ISO (UTC).
export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(local: string): string | null {
  const date = new Date(local);
  return local && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export default function ReservationEditForm(props: ReservationEditFormProps) {
  if (!isEditableReservation(props.reservation)) {
    return (
      <section aria-label="Edit reservation">
        <h2>Edit reservation</h2>
        <p>
          Only upcoming reservations can be edited. This one has already
          started, ended or been cancelled.
        </p>
        <button type="button" onClick={props.onCancel}>
          Back
        </button>
      </section>
    );
  }
  return <EditableReservationForm {...props} />;
}

type SpotsResult = { key: string; spots?: ParkingSpot[]; error?: string };

function EditableReservationForm({
  reservation,
  onSaved,
  onCancel,
}: ReservationEditFormProps) {
  const [vehicleId, setVehicleId] = useState(reservation.vehicleId);
  const [start, setStart] = useState(toLocalInput(reservation.startTime));
  const [end, setEnd] = useState(toLocalInput(reservation.endTime));
  const [spotId, setSpotId] = useState(reservation.spotId);
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);
  const [spotsResult, setSpotsResult] = useState<SpotsResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startIso = toIso(start);
  const endIso = toIso(end);
  const windowValid = startIso !== null && endIso !== null && endIso > startIso;
  // The spots shown always belong to the current vehicle and time window.
  const spotsKey = windowValid ? `${vehicleId}|${startIso}|${endIso}` : null;
  const currentSpots = spotsResult?.key === spotsKey ? spotsResult : null;
  const loadingSpots = spotsKey !== null && currentSpots === null;
  const availableSpots = currentSpots?.spots ?? [];
  const currentSpotListed = availableSpots.some(
    (spot) => spot.id === reservation.spotId,
  );
  const selectedSpotId = availableSpots.some((spot) => spot.id === spotId)
    ? spotId
    : reservation.spotId;

  useEffect(() => {
    let ignore = false;
    vehicleApi.list().then(
      (list) => {
        if (!ignore) setVehicles(list);
      },
      (err: unknown) => {
        if (!ignore) {
          setVehiclesError(errorMessage(err, "Loading vehicles failed."));
        }
      },
    );
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (spotsKey === null || startIso === null || endIso === null) return;
    let ignore = false;
    reservationApi
      .availableSpots(reservation.lotId, {
        vehicleId,
        start: startIso,
        end: endIso,
      })
      .then(
        (spots) => {
          if (!ignore) setSpotsResult({ key: spotsKey, spots });
        },
        (err: unknown) => {
          if (!ignore) {
            setSpotsResult({
              key: spotsKey,
              error: errorMessage(err, "Loading free spots failed."),
            });
          }
        },
      );
    return () => {
      ignore = true;
    };
  }, [reservation.lotId, vehicleId, spotsKey, startIso, endIso]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!windowValid) {
      setError("The end time must be after the start time.");
      return;
    }

    const changes: ReservationUpdate = {};
    if (vehicleId !== reservation.vehicleId) changes.vehicleId = vehicleId;
    if (selectedSpotId !== reservation.spotId) changes.spotId = selectedSpotId;
    if (start !== toLocalInput(reservation.startTime)) {
      changes.startTime = startIso;
    }
    if (end !== toLocalInput(reservation.endTime)) changes.endTime = endIso;
    if (Object.keys(changes).length === 0) {
      setError("Nothing has changed yet.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      onSaved(await reservationApi.update(reservation.id, changes));
    } catch (err) {
      setError(errorMessage(err, "Saving failed. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Edit reservation</h2>

      <label>
        Vehicle
        <select
          value={vehicleId}
          onChange={(event) => setVehicleId(event.target.value)}
          disabled={vehicles === null}
        >
          {vehicles === null ? (
            <option value={vehicleId}>Loading vehicles…</option>
          ) : (
            vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.licensePlate} ({vehicle.brand} {vehicle.model})
              </option>
            ))
          )}
        </select>
      </label>
      {vehiclesError && <p role="alert">{vehiclesError}</p>}

      <label>
        Start
        <input
          type="datetime-local"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          required
        />
      </label>

      <label>
        End
        <input
          type="datetime-local"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          required
        />
      </label>

      <label>
        Spot
        <select
          value={selectedSpotId}
          onChange={(event) => setSpotId(event.target.value)}
          disabled={loadingSpots}
        >
          {!currentSpotListed && (
            <option value={reservation.spotId}>Current spot</option>
          )}
          {availableSpots.map((spot) => (
            <option key={spot.id} value={spot.id}>
              Spot {spot.spotNumber} ({spotTypeLabels[spot.type]}, {spot.size})
            </option>
          ))}
        </select>
      </label>
      {loadingSpots && <p>Looking for free spots…</p>}
      {currentSpots?.error && <p role="alert">{currentSpots.error}</p>}

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={saving || loadingSpots}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
    </form>
  );
}
