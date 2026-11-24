import { type FormEvent, useEffect, useState } from "react";
import { adminApi } from "../api/adminApi";
import { ApiError } from "../api/client";
import type {
  ParkingLot,
  ParkingSpot,
  ParkingSpotSize,
  ParkingSpotStatus,
  ParkingSpotType,
} from "../types/spot";

export default function AdminSpots() {
  const [lots, setLots] = useState<ParkingLot[] | null>(null);
  const [selectedLotId, setSelectedLotId] = useState("");
  const [spotNumber, setSpotNumber] = useState("");
  const [type, setType] = useState<ParkingSpotType>("standard");
  const [size, setSize] = useState<ParkingSpotSize>("standard");
  const [status, setStatus] = useState<ParkingSpotStatus>("free");

  const [spots, setSpots] = useState<ParkingSpot[] | null>(null);
  const [isLoadingLots, setIsLoadingLots] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    adminApi.listLots().then(
      (data) => {
        if (!ignore) {
          setLots(data);
          if (data.length > 0) {
            setSelectedLotId((current) => current || data[0]?.id || "");
          }
          setIsLoadingLots(false);
        }
      },
      (err: unknown) => {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : "Failed to load parking lots.",
          );
          setIsLoadingLots(false);
        }
      },
    );
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!selectedLotId) return;
    let ignore = false;
    adminApi.listSpots(selectedLotId).then(
      (data) => {
        if (!ignore) {
          setSpots(data.spots);
        }
      },
      () => {
        // Spots list failure shouldn't block spot creation
      },
    );
    return () => {
      ignore = true;
    };
  }, [selectedLotId, reloadKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLotId) {
      setError("Please select a parking lot.");
      return;
    }
    if (!spotNumber.trim()) {
      setError("Spot number is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await adminApi.createSpot({
        spotNumber: spotNumber.trim(),
        lotId: selectedLotId,
        type,
        size,
        status,
      });

      setSuccess(`Spot "${res.spot.spotNumber}" created successfully!`);
      setSpotNumber("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to create parking spot. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingLots) {
    return <p>Loading parking lots…</p>;
  }

  return (
    <section aria-label="Create Parking Spot">
      <h1 className="page-heading">Create Parking Spot</h1>
      <p className="page-description">
        Add a new physical parking spot to a parking lot. This action is
        recorded in the Audit Log.
      </p>

      {error && <p role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}

      <form onSubmit={handleSubmit} className="admin-spot-form">
        <label>
          Parking lot
          <select
            value={selectedLotId}
            onChange={(e) => setSelectedLotId(e.target.value)}
            required
            aria-label="Parking lot"
          >
            {lots?.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.name} ({lot.address})
              </option>
            ))}
          </select>
        </label>

        <label>
          Spot number
          <input
            type="text"
            value={spotNumber}
            onChange={(e) => setSpotNumber(e.target.value)}
            placeholder="e.g. A-101"
            required
            aria-label="Spot number"
          />
        </label>

        <label>
          Spot type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ParkingSpotType)}
            aria-label="Spot type"
          >
            <option value="standard">Standard</option>
            <option value="disabled">Disabled</option>
            <option value="ev">EV</option>
          </select>
        </label>

        <label>
          Size
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as ParkingSpotSize)}
            aria-label="Size"
          >
            <option value="small">Small</option>
            <option value="standard">Standard</option>
            <option value="large">Large</option>
          </select>
        </label>

        <label>
          Initial availability
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ParkingSpotStatus)}
            aria-label="Initial availability"
          >
            <option value="free">Free</option>
            <option value="reserved">Reserved</option>
            <option value="occupied">Occupied</option>
          </select>
        </label>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create Spot"}
        </button>
      </form>

      {spots && spots.length > 0 && (
        <section
          aria-label="Existing Spots in Selected Lot"
          style={{ marginTop: "2rem" }}
        >
          <h2>Existing Spots in Selected Lot ({spots.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Spot number</th>
                <th>Type</th>
                <th>Size</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {spots.map((spot) => (
                <tr key={spot.id}>
                  <td>{spot.spotNumber}</td>
                  <td>{spot.type.toUpperCase()}</td>
                  <td>{spot.size}</td>
                  <td>{spot.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </section>
  );
}
