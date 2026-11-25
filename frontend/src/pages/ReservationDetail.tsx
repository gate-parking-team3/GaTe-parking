import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { reservationApi } from "../api/reservationApi";
import type { Reservation } from "../types/reservation";

export default function ReservationDetail() {
  const { id } = useParams<{ id: string }>();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(!id);

  useEffect(() => {
    if (!id) return;

    let ignore = false;
    reservationApi.get(id).then(
      (data) => {
        if (!ignore) {
          setReservation(data);
          setLoading(false);
        }
      },
      (err: unknown) => {
        if (!ignore) {
          if (
            err &&
            typeof err === "object" &&
            "status" in err &&
            (err as { status: number }).status === 404
          ) {
            setNotFound(true);
          } else {
            setError(
              err instanceof Error
                ? err.message
                : "Failed to load reservation details.",
            );
          }
          setLoading(false);
        }
      },
    );

    return () => {
      ignore = true;
    };
  }, [id]);

  if (loading) {
    return <p className="muted">Loading reservation…</p>;
  }

  const back = (
    <Link to="/notifications" className="btn btn-ghost">
      ← Back to Notifications
    </Link>
  );

  if (notFound) {
    return (
      <div className="page" aria-label="Reservation Details">
        <div className="head">
          <div>
            <h1>Reservation Details</h1>
          </div>
        </div>
        <div role="alert" className="err">
          <p>Reservation not found or has been deleted.</p>
        </div>
        <div>{back}</div>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="page" aria-label="Reservation Details">
        <div className="head">
          <div>
            <h1>Reservation Details</h1>
          </div>
        </div>
        <div role="alert" className="err">
          <p>{error ?? "Reservation not found."}</p>
        </div>
        <div>{back}</div>
      </div>
    );
  }

  return (
    <div className="page" aria-label="Reservation Details">
      <div className="head">
        <div>
          <h1>Reservation Details</h1>
        </div>
      </div>
      <section className="card">
        <dl className="kv">
          <dt>Reservation ID</dt>
          <dd>{reservation.id}</dd>
          <dt>Status</dt>
          <dd>{reservation.status}</dd>
          <dt>Spot ID</dt>
          <dd>{reservation.spotId}</dd>
          <dt>Vehicle ID</dt>
          <dd>{reservation.vehicleId}</dd>
          <dt>Start Time</dt>
          <dd className="tabular">
            {new Date(reservation.startTime).toLocaleString()}
          </dd>
          <dt>End Time</dt>
          <dd className="tabular">
            {new Date(reservation.endTime).toLocaleString()}
          </dd>
        </dl>
      </section>
      <div>{back}</div>
    </div>
  );
}
