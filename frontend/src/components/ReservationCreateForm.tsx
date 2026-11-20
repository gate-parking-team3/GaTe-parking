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
import { spotTypeLabels, toIso } from "./ReservationEditForm";

type ReservationCreateFormProps = {
  onCreated: (reservation: Reservation) => void;
};

type SpotsResult = { key: string; spots?: ParkingSpot[]; error?: string };

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// US 4: pick a vehicle, a lot and a time window, then one of the suitable free spots.
export default function ReservationCreateForm({
  onCreated,
}: ReservationCreateFormProps) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [lots, setLots] = useState<ParkingLot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [lotId, setLotId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [evOnly, setEvOnly] = useState(false);
  const [spotId, setSpotId] = useState("");
  const [spotsResult, setSpotsResult] = useState<SpotsResult | null>(null);
  // Bumped after a failed booking so the free spots are loaded again.
  const [spotsVersion, setSpotsVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Until the user picks something, the first vehicle and lot are selected.
  const selectedVehicle =
    vehicles?.find((vehicle) => vehicle.id === vehicleId) ?? vehicles?.[0];
  const selectedLotId =
    lots?.find((lot) => lot.id === lotId)?.id ?? lots?.[0]?.id;
  const electric = selectedVehicle?.engineType === "electric";
  const evFilter = electric && evOnly;

  const startIso = toIso(start);
  const endIso = toIso(end);
  const windowValid = startIso !== null && endIso !== null && endIso > startIso;
  // The spots shown always belong to the current vehicle, lot, window and filter.
  const spotsKey =
    selectedVehicle && selectedLotId && windowValid
      ? `${selectedVehicle.id}|${selectedLotId}|${startIso}|${endIso}|${evFilter}|${spotsVersion}`
      : null;
  const currentSpots = spotsResult?.key === spotsKey ? spotsResult : null;
  const loadingSpots = spotsKey !== null && currentSpots === null;
  const availableSpots = currentSpots?.spots ?? [];
  const selectedSpotId = availableSpots.some((spot) => spot.id === spotId)
    ? spotId
    : "";

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
        evOnly: evFilter,
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
  }, [spotsKey, selectedVehicle, selectedLotId, startIso, endIso, evFilter]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!windowValid) {
      setError("The end time must be after the start time.");
      return;
    }
    if (!selectedVehicle || !selectedSpotId) {
      setError("Choose a parking spot first.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      onCreated(
        await reservationApi.create({
          vehicleId: selectedVehicle.id,
          spotId: selectedSpotId,
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

  if (loadError) return <p role="alert">{loadError}</p>;
  if (vehicles === null || lots === null) return <p>Loading…</p>;
  if (vehicles.length === 0) {
    return (
      <p>
        You have no registered vehicles yet.{" "}
        <Link to="/vehicles">Add a vehicle</Link> before you reserve a spot.
      </p>
    );
  }
  if (lots.length === 0) return <p>There are no parking lots yet.</p>;

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Vehicle
        <select
          value={selectedVehicle?.id}
          onChange={(event) => setVehicleId(event.target.value)}
        >
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.licensePlate} ({vehicle.brand} {vehicle.model})
            </option>
          ))}
        </select>
      </label>

      <label>
        Parking lot
        <select
          value={selectedLotId}
          onChange={(event) => setLotId(event.target.value)}
        >
          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.name}, {lot.address}
            </option>
          ))}
        </select>
      </label>

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

      {electric && (
        <label>
          <input
            type="checkbox"
            checked={evOnly}
            onChange={(event) => setEvOnly(event.target.checked)}
          />
          EV spots only
        </label>
      )}

      {spotsKey === null ? (
        <p>Choose a start and an end time to see the free spots.</p>
      ) : (
        <label>
          Spot
          <select
            value={selectedSpotId}
            onChange={(event) => setSpotId(event.target.value)}
            disabled={loadingSpots || availableSpots.length === 0}
            required
          >
            <option value="">Choose a spot</option>
            {availableSpots.map((spot) => (
              <option key={spot.id} value={spot.id}>
                Spot {spot.spotNumber} ({spotTypeLabels[spot.type]}, {spot.size}
                )
              </option>
            ))}
          </select>
        </label>
      )}
      {loadingSpots && <p>Looking for free spots…</p>}
      {currentSpots?.spots?.length === 0 && (
        <p>No suitable spot is free for this time. Try another time or lot.</p>
      )}
      {currentSpots?.error && <p role="alert">{currentSpots.error}</p>}

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={saving || loadingSpots}>
        {saving ? "Reserving…" : "Reserve"}
      </button>
    </form>
  );
}
