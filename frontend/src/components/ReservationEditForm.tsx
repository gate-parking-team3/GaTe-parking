import { useEffect, useState, type FormEvent } from "react";
import { reservationApi } from "../api/reservationApi";
import { vehicleApi } from "../api/vehicleApi";
import {
  isEditableReservation,
  type ParkingLot,
  type ParkingSpot,
  type Reservation,
  type ReservationUpdate,
} from "../types/reservation";
import type { Vehicle } from "../types/vehicle";
import Modal from "./Modal";
import { formatPlate } from "./Plate";
import { toDateInput, toMoment } from "./ReservationCreateForm";

/** What the form needs to know about the booking being changed. */
export type EditableReservation = Pick<
  Reservation,
  "id" | "status" | "startTime" | "endTime" | "vehicleId" | "spotId" | "lotId"
> & { spotNumber: string };

type ReservationEditFormProps = {
  reservation: EditableReservation;
  onSaved: (reservation: Reservation) => void;
  onCancel: () => void;
};

type SpotsResult = { key: string; spots?: ParkingSpot[]; error?: string };

/** Local time as the value of an <input type="time">. */
function toTimeInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// US 11: change the vehicle, time or spot of a booking that has not started.
export default function ReservationEditForm(props: ReservationEditFormProps) {
  if (!isEditableReservation(props.reservation)) {
    return (
      <Modal title="Change booking" onClose={props.onCancel}>
        <div className="modal-b">
          <p>Only bookings that haven't started can be changed.</p>
        </div>
        <div className="modal-f">
          <button type="button" className="btn" onClick={props.onCancel}>
            OK
          </button>
        </div>
      </Modal>
    );
  }
  return <EditableReservationForm {...props} />;
}

function EditableReservationForm({
  reservation,
  onSaved,
  onCancel,
}: ReservationEditFormProps) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [lots, setLots] = useState<ParkingLot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState(reservation.vehicleId);
  const [lotId, setLotId] = useState(reservation.lotId);
  const [date, setDate] = useState(
    toDateInput(new Date(reservation.startTime)),
  );
  const [from, setFrom] = useState(toTimeInput(reservation.startTime));
  const [to, setTo] = useState(toTimeInput(reservation.endTime));
  const [spotId, setSpotId] = useState(reservation.spotId);
  const [spotsResult, setSpotsResult] = useState<SpotsResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startMoment = toMoment(date, from);
  const endMoment = toMoment(date, to);
  const startIso = startMoment?.toISOString() ?? null;
  const endIso = endMoment?.toISOString() ?? null;
  const windowValid =
    startMoment !== null && endMoment !== null && endMoment > startMoment;

  // The spots shown always belong to the current vehicle, lot and time.
  const spotsKey = windowValid
    ? `${vehicleId}|${lotId}|${startIso}|${endIso}`
    : null;
  const currentSpots = spotsResult?.key === spotsKey ? spotsResult : null;
  const loadingSpots = spotsKey !== null && currentSpots === null;
  // The booking's own spot is busy because of the booking itself, so it is
  // always offered while the lot stays the same; the backend accepts it.
  const keepsLot = lotId === reservation.lotId;
  const spotOptions = [
    ...(keepsLot
      ? [{ id: reservation.spotId, label: `${reservation.spotNumber} (now)` }]
      : []),
    ...(currentSpots?.spots ?? [])
      .filter((spot) => spot.id !== reservation.spotId)
      .map((spot) => ({
        id: spot.id,
        label: `${spot.spotNumber}${spot.type === "ev" ? " (EV)" : ""}`,
      })),
  ];
  const selectedSpotId = spotOptions.some((option) => option.id === spotId)
    ? spotId
    : (spotOptions[0]?.id ?? "");

  useEffect(() => {
    let ignore = false;
    Promise.all([vehicleApi.list(), reservationApi.lots()]).then(
      ([vehicleList, lotList]) => {
        if (ignore) return;
        setVehicles(vehicleList);
        setLots(lotList);
      },
      (err: unknown) => {
        if (!ignore) setLoadError(errorMessage(err, "Loading failed."));
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
      .availableSpots(lotId, { vehicleId, start: startIso, end: endIso })
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
  }, [lotId, vehicleId, spotsKey, startIso, endIso]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!windowValid || startMoment === null || endIso === null) {
      setError("The end time must be after the start time.");
      return;
    }
    if (startMoment.getTime() <= Date.now()) {
      setError("That start time has already passed.");
      return;
    }
    if (!selectedSpotId) {
      setError("No spot is free at that time. Try another time or lot.");
      return;
    }

    const changes: ReservationUpdate = {};
    if (vehicleId !== reservation.vehicleId) changes.vehicleId = vehicleId;
    if (selectedSpotId !== reservation.spotId) changes.spotId = selectedSpotId;
    if (startMoment.getTime() !== new Date(reservation.startTime).getTime()) {
      changes.startTime = startMoment.toISOString();
    }
    if (endIso !== new Date(reservation.endTime).toISOString()) {
      changes.endTime = endIso;
    }
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
    <Modal title="Change booking" onClose={onCancel} busy={saving}>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="modal-b">
          {loadError && (
            <div role="alert" className="err">
              {loadError}
            </div>
          )}
          {error && (
            <div role="alert" className="err">
              {error}
            </div>
          )}

          {vehicles && vehicles.length > 1 && (
            <div className="field">
              <label htmlFor="edit-vehicle">Vehicle</label>
              <select
                id="edit-vehicle"
                className="select"
                value={vehicleId}
                onChange={(event) => setVehicleId(event.target.value)}
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {formatPlate(vehicle.licensePlate)} · {vehicle.brand}{" "}
                    {vehicle.model}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label htmlFor="edit-date">Date</label>
            <input
              id="edit-date"
              className="input"
              type="date"
              min={toDateInput(new Date())}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="edit-from">From</label>
              <input
                id="edit-from"
                className="input"
                type="time"
                step={900}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="edit-to">To</label>
              <input
                id="edit-to"
                className="input"
                type="time"
                step={900}
                value={to}
                onChange={(event) => setTo(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="edit-lot">Lot</label>
              <select
                id="edit-lot"
                className="select"
                value={lotId}
                onChange={(event) => setLotId(event.target.value)}
                disabled={lots === null}
              >
                {lots === null ? (
                  <option value={lotId}>Loading…</option>
                ) : (
                  lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="field">
              <label htmlFor="edit-spot">Spot</label>
              <select
                id="edit-spot"
                className="select"
                value={selectedSpotId}
                onChange={(event) => setSpotId(event.target.value)}
                disabled={
                  !windowValid || loadingSpots || spotOptions.length === 0
                }
              >
                {!windowValid ? (
                  <option value="">Fix the time first</option>
                ) : spotOptions.length === 0 ? (
                  <option value="">
                    {loadingSpots ? "Loading…" : "None free"}
                  </option>
                ) : (
                  spotOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
          {currentSpots?.error && (
            <div role="alert" className="err">
              {currentSpots.error}
            </div>
          )}
        </div>

        <div className="modal-f">
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || loadingSpots}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
