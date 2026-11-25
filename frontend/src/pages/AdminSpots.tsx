import { type FormEvent, useEffect, useState } from "react";
import { adminApi } from "../api/adminApi";
import { ApiError } from "../api/client";
import Icon from "../components/Icon";
import type {
  ParkingLot,
  ParkingSpot,
  ParkingSpotSize,
  ParkingSpotStatus,
  ParkingSpotType,
} from "../types/spot";

const STATUS_PILL = {
  free: { label: "Free", tone: "green" },
  reserved: { label: "Booked", tone: "blue" },
  occupied: { label: "Vehicle parked", tone: "gray" },
} as const;

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

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
    return (
      <div className="page">
        <p className="muted">Loading parking lots…</p>
      </div>
    );
  }

  return (
    <div className="page" aria-label="Create Parking Spot">
      <div className="head">
        <div>
          <h1>Create Parking Spot</h1>
          <p>
            Add a new physical parking spot to a parking lot. This action is
            recorded in the Audit Log.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="err">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="ok-note">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form card">
        <div className="field">
          <label htmlFor="spot-lot">Parking lot</label>
          <select
            id="spot-lot"
            className="select"
            value={selectedLotId}
            onChange={(e) => setSelectedLotId(e.target.value)}
            required
          >
            {lots?.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.name} ({lot.address})
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="spot-number">Spot number</label>
          <input
            id="spot-number"
            className="input"
            type="text"
            value={spotNumber}
            onChange={(e) => setSpotNumber(e.target.value)}
            placeholder="e.g. A-101"
            required
          />
          <span className="hint">Letters, digits and hyphens only.</span>
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="spot-type">Spot type</label>
            <select
              id="spot-type"
              className="select"
              value={type}
              onChange={(e) => setType(e.target.value as ParkingSpotType)}
            >
              <option value="standard">Standard</option>
              <option value="disabled">Disabled</option>
              <option value="ev">EV</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="spot-size">Size</label>
            <select
              id="spot-size"
              className="select"
              value={size}
              onChange={(e) => setSize(e.target.value as ParkingSpotSize)}
            >
              <option value="small">Small</option>
              <option value="standard">Standard</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="spot-status">Initial availability</label>
            <select
              id="spot-status"
              className="select"
              value={status}
              onChange={(e) => setStatus(e.target.value as ParkingSpotStatus)}
            >
              <option value="free">Free</option>
              <option value="reserved">Reserved</option>
              <option value="occupied">Occupied</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg btn-block"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating…" : "Create Spot"}
        </button>
      </form>

      {spots && spots.length > 0 && (
        <section aria-label="Existing Spots in Selected Lot">
          <h2 className="section-title">
            Existing Spots in Selected Lot ({spots.length})
          </h2>
          <div className="tbl-wrap card">
            <table className="tbl">
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
                    <td>
                      <b>{spot.spotNumber}</b>
                    </td>
                    <td>
                      {spot.type === "ev" ? (
                        <span className="ev">
                          <Icon name="bolt" />
                          EV
                        </span>
                      ) : (
                        capitalize(spot.type)
                      )}
                    </td>
                    <td>{capitalize(spot.size)}</td>
                    <td>
                      <span className={`pill ${STATUS_PILL[spot.status].tone}`}>
                        {STATUS_PILL[spot.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
