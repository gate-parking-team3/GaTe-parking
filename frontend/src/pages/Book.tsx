import { useState } from "react";
import { Link } from "react-router";
import Icon from "../components/Icon";
import ReservationCreateForm from "../components/ReservationCreateForm";
import type { Reservation } from "../types/reservation";

function formatWindow(reservation: Reservation): string {
  const start = new Date(reservation.startTime);
  const end = new Date(reservation.endTime);
  const day = start.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = (date: Date) =>
    date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${time(start)}–${time(end)}`;
}

export default function Book() {
  const [created, setCreated] = useState<Reservation | null>(null);

  return (
    <div className="page">
      <div className="head">
        <div>
          <h1>Book a spot</h1>
          <p>Pick a time and a free spot.</p>
        </div>
      </div>

      {created ? (
        <section className="card" aria-label="Booking confirmed">
          <div className="success">
            <span className="ok">
              <Icon name="check" />
            </span>
            <h2 role="status">Your spot is booked</h2>
            <p className="muted">{formatWindow(created)}</p>
            <div className="acts">
              <button
                type="button"
                className="btn"
                onClick={() => setCreated(null)}
              >
                Book another spot
              </button>
              <Link className="btn btn-primary" to="/reservations">
                See my bookings
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <ReservationCreateForm onCreated={setCreated} />
      )}
    </div>
  );
}
