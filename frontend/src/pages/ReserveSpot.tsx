import { useState } from "react";
import { Link } from "react-router";
import ReservationCreateForm from "../components/ReservationCreateForm";
import type { Reservation } from "../types/reservation";

export default function ReserveSpot() {
  const [created, setCreated] = useState<Reservation | null>(null);

  return (
    <>
      <h1 className="page-heading">Reserve a Spot</h1>
      {created ? (
        <section aria-label="Reservation confirmed">
          <p role="status">
            Your spot is reserved from{" "}
            {new Date(created.startTime).toLocaleString()} to{" "}
            {new Date(created.endTime).toLocaleString()}.
          </p>
          <Link to="/reservations">See my reservations</Link>{" "}
          <button type="button" onClick={() => setCreated(null)}>
            Reserve another spot
          </button>
        </section>
      ) : (
        <>
          <p className="page-description">
            Choose your vehicle, a parking lot and when you will park. Only
            spots that suit your vehicle and are free for the whole time are
            offered.
          </p>
          <ReservationCreateForm onCreated={setCreated} />
        </>
      )}
    </>
  );
}
