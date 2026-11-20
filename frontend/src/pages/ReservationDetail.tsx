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
    return <p>Loading reservation…</p>;
  }

  if (notFound) {
    return (
      <section aria-label="Reservation Details">
        <h1 className="page-heading">Reservation Details</h1>
        <div role="alert">
          <p>Reservation not found or has been deleted.</p>
        </div>
        <Link to="/notifications" className="back-link">
          ← Back to Notifications
        </Link>
      </section>
    );
  }

  if (error || !reservation) {
    return (
      <section aria-label="Reservation Details">
        <h1 className="page-heading">Reservation Details</h1>
        <div role="alert">
          <p>{error ?? "Reservation not found."}</p>
        </div>
        <Link to="/notifications" className="back-link">
          ← Back to Notifications
        </Link>
      </section>
    );
  }

  return (
    <section aria-label="Reservation Details">
      <h1 className="page-heading">Reservation Details</h1>
      <dl className="reservation-detail-list">
        <div>
          <dt>Reservation ID</dt>
          <dd>{reservation.id}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{reservation.status}</dd>
        </div>
        <div>
          <dt>Spot ID</dt>
          <dd>{reservation.spotId}</dd>
        </div>
        <div>
          <dt>Vehicle ID</dt>
          <dd>{reservation.vehicleId}</dd>
        </div>
        <div>
          <dt>Start Time</dt>
          <dd>{new Date(reservation.startTime).toLocaleString()}</dd>
        </div>
        <div>
          <dt>End Time</dt>
          <dd>{new Date(reservation.endTime).toLocaleString()}</dd>
        </div>
      </dl>
      <Link to="/notifications" className="back-link">
        ← Back to Notifications
      </Link>
    </section>
  );
}
