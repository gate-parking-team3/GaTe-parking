import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { reservationApi } from "../api/reservationApi";
import { vehicleApi } from "../api/vehicleApi";
import type {
  ParkingLot,
  ParkingSpot,
  Reservation,
} from "../types/reservation";
import type { Vehicle } from "../types/vehicle";
import Icon from "./Icon";
import Plate from "./Plate";

type ReservationCreateFormProps = {
  onCreated: (reservation: Reservation) => void;
};

type SpotsResult = { key: string; spots?: ParkingSpot[]; error?: string };

// A booking can start up to five minutes ago, so "now" in the form is forgiving.
const GRACE_MS = 5 * 60 * 1000;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Local date as the value of an <input type="date">. */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Combine the date and time inputs into one moment, or null if either is empty. */
export function toMoment(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const moment = new Date(`${date}T${time}`);
  return Number.isNaN(moment.getTime()) ? null : moment;
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function defaultDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toDateInput(tomorrow);
}

// US 4: pick a vehicle, a time and one of the suitable free spots.
export default function ReservationCreateForm({
  onCreated,
}: ReservationCreateFormProps) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [lots, setLots] = useState<ParkingLot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [lotId, setLotId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [from, setFrom] = useState("08:00");
  const [to, setTo] = useState("17:00");
  const [spotId, setSpotId] = useState("");
  const [spotsResult, setSpotsResult] = useState<SpotsResult | null>(null);
  // Bumped after a failed booking so the free spots are loaded again.
  const [spotsVersion, setSpotsVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Until the user picks something, the first vehicle and lot are selected.
  const selectedVehicle =
    vehicles?.find((vehicle) => vehicle.id === vehicleId) ?? vehicles?.[0];
  const selectedLot = lots?.find((lot) => lot.id === lotId) ?? lots?.[0];
  const selectedLotId = selectedLot?.id;

  const startMoment = toMoment(date, from);
  const endMoment = toMoment(date, to);
  const startIso = startMoment?.toISOString() ?? null;
  const endIso = endMoment?.toISOString() ?? null;
  const windowValid =
    startMoment !== null && endMoment !== null && endMoment > startMoment;
  const windowProblem =
    startMoment === null || endMoment === null
      ? "Enter a date and both times."
      : endMoment <= startMoment
        ? "The end time must be after the start time."
        : null;

  // The spots shown always belong to the current vehicle, lot and time.
  const spotsKey =
    selectedVehicle && selectedLotId && windowValid
      ? `${selectedVehicle.id}|${selectedLotId}|${startIso}|${endIso}|${spotsVersion}`
      : null;
  const currentSpots = spotsResult?.key === spotsKey ? spotsResult : null;
  const loadingSpots = spotsKey !== null && currentSpots === null;
  const availableSpots = currentSpots?.spots ?? [];
  const selectedSpot = availableSpots.find((spot) => spot.id === spotId);

  useEffect(() => {
    let ignore = false;
    Promise.all([vehicleApi.list(), reservationApi.lots()]).then(
      ([vehicleList, lotList]) => {
        if (ignore) return;
        setVehicles(vehicleList);
        setLots(lotList);
      },
      (err: unknown) => {
        if (!ignore) {
          setLoadError(errorMessage(err, "Loading your vehicles failed."));
        }
      },
    );
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (
      spotsKey === null ||
      !selectedVehicle ||
      !selectedLotId ||
      startIso === null ||
      endIso === null
    ) {
      return;
    }
    let ignore = false;
    reservationApi
      .availableSpots(selectedLotId, {
        vehicleId: selectedVehicle.id,
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
  }, [spotsKey, selectedVehicle, selectedLotId, startIso, endIso]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!windowValid || startIso === null || endIso === null) {
      setError(windowProblem);
      return;
    }
    if (startMoment && startMoment.getTime() < Date.now() - GRACE_MS) {
      setError("That time has already passed.");
      return;
    }
    if (!selectedVehicle || !selectedSpot) {
      setError("Tap a free spot first.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      onCreated(
        await reservationApi.create({
          vehicleId: selectedVehicle.id,
          spotId: selectedSpot.id,
          startTime: startIso,
          endTime: endIso,
        }),
      );
    } catch (err) {
      setError(errorMessage(err, "Booking failed. Please try again."));
      // The spot may have been taken meanwhile, so ask for fresh free spots.
      setSpotsVersion((version) => version + 1);
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div role="alert" className="err">
        {loadError}
      </div>
    );
  }
  if (vehicles === null || lots === null) {
    return <p className="muted">Loading…</p>;
  }
  if (vehicles.length === 0 || !selectedVehicle) {
    return (
      <section className="card">
        <div className="empty">
          <h3>Add your vehicle first</h3>
          <p>You book parking for a specific vehicle.</p>
          <Link className="btn btn-primary" to="/vehicles">
            Add a vehicle
          </Link>
        </div>
      </section>
    );
  }
  if (lots.length === 0) {
    return (
      <section className="card">
        <div className="empty">
          <h3>No parking lots yet</h3>
          <p>An administrator needs to add a parking lot first.</p>
        </div>
      </section>
    );
  }

  const vehicle = selectedVehicle;

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <div className="step">
        <div className="step-h">
          <span className="step-n">1</span>Vehicle
        </div>
        {vehicles.length === 1 ? (
          <div className="item-t">
            <Plate plate={vehicle.licensePlate} />
            <span>
              {vehicle.brand} {vehicle.model}
            </span>
            {vehicle.engineType === "electric" && (
              <span className="ev">
                <Icon name="bolt" />
                Electric
              </span>
            )}
          </div>
        ) : (
          <div className="choice cars" role="radiogroup" aria-label="Vehicle">
            {vehicles.map((item) => (
              <label key={item.id}>
                <input
                  type="radio"
                  name="vehicle"
                  value={item.id}
                  checked={item.id === vehicle.id}
                  onChange={() => setVehicleId(item.id)}
                />
                <Plate plate={item.licensePlate} />
                <span className="small">
                  {item.brand} {item.model}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="step">
        <div className="step-h">
          <span className="step-n">2</span>When
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="book-date">Date</label>
            <input
              id="book-date"
              className="input"
              type="date"
              min={toDateInput(new Date())}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="book-from">From</label>
            <input
              id="book-from"
              className="input"
              type="time"
              step={900}
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="book-to">To</label>
            <input
              id="book-to"
              className="input"
              type="time"
              step={900}
              value={to}
              onChange={(event) => setTo(event.target.value)}
              required
            />
          </div>
        </div>
      </div>

      <div className="step">
        <div className="step-h">
          <span className="step-n">3</span>Spot
        </div>
        <div className="seg" role="group" aria-label="Parking lot">
          {lots.map((lot) => (
            <button
              key={lot.id}
              type="button"
              aria-pressed={lot.id === selectedLotId}
              onClick={() => setLotId(lot.id)}
            >
              {lot.name}
            </button>
          ))}
        </div>

        {windowProblem ? (
          <div className="err">{windowProblem}</div>
        ) : loadingSpots ? (
          <p className="muted small">Looking for free spots…</p>
        ) : currentSpots?.error ? (
          <div role="alert" className="err">
            {currentSpots.error}
          </div>
        ) : availableSpots.length === 0 ? (
          <p className="muted small">
            Nothing free for your vehicle at this time. Try the other lot or
            another time.
          </p>
        ) : (
          <>
            <p className="muted small">
              {availableSpots.length} spot
              {availableSpots.length === 1 ? "" : "s"} free for your vehicle.
            </p>
            <div className="tiles">
              {availableSpots.map((spot) => {
                const selected = spot.id === selectedSpot?.id;
                return (
                  <button
                    key={spot.id}
                    type="button"
                    className={selected ? "tile sel" : "tile"}
                    aria-pressed={selected}
                    aria-label={`Spot ${spot.spotNumber}${spot.type === "ev" ? ", EV" : ""}`}
                    onClick={() => setSpotId(spot.id)}
                  >
                    <span className="tile-n">
                      {spot.spotNumber}
                      {spot.type === "ev" && <Icon name="bolt" />}
                    </span>
                    <span className="tile-m">
                      {selected ? "Selected" : "Free"}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="confirm">
        {error ? (
          <span role="alert" className="err">
            {error}
          </span>
        ) : selectedSpot ? (
          <span>
            <b>Spot {selectedSpot.spotNumber}</b>, {selectedLot?.name} ·{" "}
            {formatDay(date)} {from}–{to}
          </span>
        ) : (
          <span className="muted">Tap a free spot</span>
        )}
        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={saving || !selectedSpot}
        >
          {saving
            ? "Booking…"
            : selectedSpot
              ? `Book spot ${selectedSpot.spotNumber}`
              : "Book"}
        </button>
      </div>
    </form>
  );
}
