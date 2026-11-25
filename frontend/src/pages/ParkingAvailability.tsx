import { useEffect, useState } from "react";
import { Link } from "react-router";
import { lotApi } from "../api/lotApi";
import Icon from "../components/Icon";
import type { ParkingLot, ParkingLotDetail } from "../types/lot";
import type { ParkingSpot } from "../types/reservation";

type SpotFilter = "all" | "free" | "occupied" | "reserved";

export default function ParkingAvailability() {
  const [lots, setLots] = useState<ParkingLot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [lotDetail, setLotDetail] = useState<ParkingLotDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailReloadCount, setDetailReloadCount] = useState(0);

  const [spotFilter, setSpotFilter] = useState<SpotFilter>("all");

  useEffect(() => {
    let ignore = false;
    lotApi.list().then(
      (data) => {
        if (!ignore) setLots(Array.isArray(data) ? data : []);
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

  useEffect(() => {
    if (!selectedLotId) return;
    let ignore = false;
    lotApi.get(selectedLotId).then(
      (data) => {
        if (!ignore) {
          setLotDetail(data);
          setDetailLoading(false);
        }
      },
      (err: unknown) => {
        if (!ignore) {
          setDetailError(
            err instanceof Error
              ? err.message
              : "Failed to load parking lot details.",
          );
          setDetailLoading(false);
        }
      },
    );
    return () => {
      ignore = true;
    };
  }, [selectedLotId, detailReloadCount]);

  function retry() {
    setError(null);
    setReloadCount((c) => c + 1);
  }

  function retryDetail() {
    setDetailError(null);
    setDetailLoading(true);
    setDetailReloadCount((c) => c + 1);
  }

  function handleSelectLot(lotId: string) {
    setSelectedLotId(lotId);
    setLotDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    setSpotFilter("all");
  }

  function handleBack() {
    setSelectedLotId(null);
    setLotDetail(null);
    setDetailLoading(false);
    setDetailError(null);
    setSpotFilter("all");
  }

  // --- Detail View of a Selected Parking Lot ---
  if (selectedLotId) {
    return (
      <div className="page" aria-label="Parking Lot Detail">
        <div>
          <button
            type="button"
            onClick={handleBack}
            className="btn btn-ghost"
            aria-label="Back to all lots"
          >
            &larr; Back to all lots
          </button>
        </div>

        {detailError ? (
          <section className="card">
            <div role="alert" className="err">
              <p>{detailError}</p>
              <button
                type="button"
                className="btn btn-sm"
                onClick={retryDetail}
              >
                Try again
              </button>
            </div>
          </section>
        ) : detailLoading || lotDetail === null ? (
          <p className="muted">Loading lot details…</p>
        ) : (
          <>
            <div className="head">
              <div>
                <h1>{lotDetail.name}</h1>
                <p>{lotDetail.address}</p>
              </div>
              <Link className="btn btn-primary" to="/book">
                Book a spot
              </Link>
            </div>

            {/* Availability Breakdown */}
            <div className="figures" aria-label="Availability breakdown">
              <div>
                <b>{lotDetail.availability.available}</b>
                <span>Available</span>
              </div>
              <div>
                <b>{lotDetail.availability.occupied}</b>
                <span>Occupied</span>
              </div>
              <div>
                <b>{lotDetail.availability.reserved}</b>
                <span>Reserved</span>
              </div>
              <div>
                <b>{lotDetail.availability.total}</b>
                <span>Total capacity</span>
              </div>
            </div>

            {/* Filter by spot status */}
            <div className="row">
              <span className="eyebrow">Filter spots</span>
              <div
                className="seg"
                role="group"
                aria-label="Filter spots by status"
              >
                <button
                  type="button"
                  aria-pressed={spotFilter === "all"}
                  onClick={() => setSpotFilter("all")}
                >
                  All ({lotDetail.spots.length})
                </button>
                <button
                  type="button"
                  aria-pressed={spotFilter === "free"}
                  onClick={() => setSpotFilter("free")}
                >
                  Available ({lotDetail.availability.available})
                </button>
                <button
                  type="button"
                  aria-pressed={spotFilter === "occupied"}
                  onClick={() => setSpotFilter("occupied")}
                >
                  Occupied ({lotDetail.availability.occupied})
                </button>
                <button
                  type="button"
                  aria-pressed={spotFilter === "reserved"}
                  onClick={() => setSpotFilter("reserved")}
                >
                  Reserved ({lotDetail.availability.reserved})
                </button>
              </div>
            </div>

            {/* Individual Spot Tiles Map */}
            {lotDetail.spots.length === 0 ? (
              <section className="card">
                <div className="empty">
                  <h3>No spots found in this parking lot.</h3>
                </div>
              </section>
            ) : (
              <div className="tiles">
                {lotDetail.spots
                  .filter(
                    (spot) =>
                      spotFilter === "all" || spot.status === spotFilter,
                  )
                  .map((spot) => (
                    <SpotTile key={spot.id} spot={spot} />
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // --- List View of All Parking Lots ---
  return (
    <div className="page" aria-label="Parking Availability">
      <div className="head">
        <div>
          <h1>Parking Availability</h1>
          <p>Real-time parking lot occupancy and free spot counts.</p>
        </div>
        <Link className="btn btn-primary" to="/book">
          Book a spot
        </Link>
      </div>

      <h2 className="section-title">Parking lots</h2>

      {error ? (
        <section className="card">
          <div role="alert" className="err">
            <p>{error}</p>
            <button type="button" className="btn btn-sm" onClick={retry}>
              Try again
            </button>
          </div>
        </section>
      ) : lots === null ? (
        <p className="muted">Loading parking lots…</p>
      ) : lots.length === 0 ? (
        <section className="card">
          <div className="empty">
            <h3>No parking lots available.</h3>
            <p>An administrator needs to configure parking lots first.</p>
          </div>
        </section>
      ) : (
        <section className="card" aria-label="Available lots list">
          {lots.map((lot) => {
            const capacity = lot.availability.total || 1;
            const percent = Math.min(
              100,
              Math.round((lot.availability.available / capacity) * 100),
            );

            return (
              <article key={lot.id} className="item">
                <div className="grow">
                  <div className="item-t">
                    <span>{lot.name}</span>
                    {lot.evCapacity > 0 && (
                      <span className="ev">
                        <Icon name="bolt" small />
                        {lot.evCapacity} EV
                      </span>
                    )}
                  </div>
                  <div className="item-s">
                    <span>{lot.address}</span>
                    <span aria-hidden="true"> · </span>
                    <span>
                      {lot.availability.available} of {lot.availability.total}{" "}
                      spots free
                    </span>
                  </div>
                  <div className="bar" aria-hidden="true">
                    <i style={{ width: `${percent}%` }} />
                  </div>
                </div>

                <div className="acts">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleSelectLot(lot.id)}
                    aria-label={`View details for ${lot.name}`}
                  >
                    View details &rarr;
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function SpotTile({ spot }: { spot: ParkingSpot }) {
  const statusClass =
    spot.status === "occupied"
      ? "tile st-occupied"
      : spot.status === "reserved"
        ? "tile st-reserved"
        : "tile";

  const statusLabel =
    spot.status === "free"
      ? "Available"
      : spot.status === "occupied"
        ? "Occupied"
        : "Reserved";

  return (
    <div
      className={statusClass}
      data-testid={`spot-${spot.spotNumber}`}
      aria-label={`Spot ${spot.spotNumber}, ${statusLabel}${spot.type === "ev" ? ", EV" : ""}`}
    >
      <span className="tile-n">
        {spot.spotNumber}
        {spot.type === "ev" && <Icon name="bolt" small />}
      </span>
      <span className="tile-m">{statusLabel}</span>
    </div>
  );
}
