import { useEffect, useState } from "react";
import { Link } from "react-router";
import { reservationApi } from "../api/reservationApi";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import Plate from "../components/Plate";
import ReservationEditForm, {
  type EditableReservation,
} from "../components/ReservationEditForm";
import {
  isEditableReservation,
  type CurrentReservation,
  type ParkingLot,
  type ReservationStatus,
} from "../types/reservation";

// Status labels and pill colours from docs/design-system.md.
const statusPills: Record<ReservationStatus, [string, string]> = {
  reserved: ["Booked", "pill blue"],
  active: ["Parked", "pill green"],
  completed: ["Done", "pill gray"],
  cancelled: ["Cancelled", "pill gray"],
};

const TOAST_MS = 4000;

function formatWindow(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const day = start.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = (date: Date) =>
    date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${time(start)}–${time(end)}`;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/** The edit form needs the vehicle and spot, which can be missing (null). */
function toEditable(booking: CurrentReservation): EditableReservation | null {
  if (!booking.vehicle || !booking.parkingSpot) return null;
  return {
    id: booking.id,
    status: booking.status,
    startTime: booking.startTime,
    endTime: booking.endTime,
    vehicleId: booking.vehicle.id,
    spotId: booking.parkingSpot.id,
    lotId: booking.parkingSpot.lotId,
    spotNumber: booking.parkingSpot.spotNumber,
  };
}

// US 6 and US 11: the user's upcoming bookings, each with Change and Delete.
export default function Reservations() {
  const [bookings, setBookings] = useState<CurrentReservation[] | null>(null);
  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [editing, setEditing] = useState<EditableReservation | null>(null);
  const [deleting, setDeleting] = useState<CurrentReservation | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([reservationApi.current(), reservationApi.lots()]).then(
      ([bookingList, lotList]) => {
        if (ignore) return;
        setBookings(bookingList);
        setLots(lotList);
      },
      (err: unknown) => {
        if (!ignore) {
          setError(errorMessage(err, "Loading failed. Please try again."));
        }
      },
    );
    return () => {
      ignore = true;
    };
  }, [reloadCount]);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  function reload() {
    setError(null);
    setReloadCount((count) => count + 1);
  }

  function where(booking: CurrentReservation): string {
    const spot = booking.parkingSpot;
    if (!spot) return "Unknown spot";
    const lot = lots.find((item) => item.id === spot.lotId);
    return `${lot ? `${lot.name}, ` : ""}spot ${spot.spotNumber}`;
  }

  function handleSaved() {
    setEditing(null);
    setToast("Booking updated.");
    reload();
  }

  function closeDelete() {
    setDeleting(null);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await reservationApi.remove(deleting.id);
      setBookings(
        (current) =>
          current?.filter((booking) => booking.id !== deleting.id) ?? null,
      );
      setDeleting(null);
      setToast("Booking deleted.");
    } catch (err) {
      setDeleteError(errorMessage(err, "Deleting failed. Please try again."));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="head">
        <div>
          <h1>My bookings</h1>
          <p>Change or delete a booking before it starts.</p>
        </div>
        <Link className="btn btn-primary" to="/book">
          Book a spot
        </Link>
      </div>

      <h2 className="section-title">Upcoming</h2>
      {error ? (
        <div role="alert" className="err">
          <p>{error}</p>
          <button type="button" className="btn btn-sm" onClick={reload}>
            Try again
          </button>
        </div>
      ) : bookings === null ? (
        <p className="muted">Loading bookings…</p>
      ) : bookings.length === 0 ? (
        <section className="card">
          <div className="empty">
            <p>No upcoming bookings.</p>
          </div>
        </section>
      ) : (
        <section className="card" aria-label="Upcoming bookings">
          {bookings.map((booking) => {
            const [label, pillClass] = statusPills[booking.status];
            const editable = isEditableReservation(booking)
              ? toEditable(booking)
              : null;
            return (
              <div key={booking.id} className="item">
                <div className="grow">
                  <div className="item-t">
                    {where(booking)}
                    {booking.parkingSpot?.type === "ev" && (
                      <span className="ev">
                        <Icon name="bolt" />
                        EV
                      </span>
                    )}
                  </div>
                  <div className="item-s tabular">
                    <span>
                      {formatWindow(booking.startTime, booking.endTime)}
                    </span>
                    {booking.vehicle && (
                      <Plate plate={booking.vehicle.licensePlate} />
                    )}
                  </div>
                </div>
                <span className={pillClass}>{label}</span>
                {booking.status === "reserved" && (
                  <div className="acts">
                    {editable && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setEditing(editable)}
                        aria-label={`Change booking for ${where(booking)}`}
                      >
                        Change
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDeleting(booking)}
                      aria-label={`Delete booking for ${where(booking)}`}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {editing && (
        <ReservationEditForm
          reservation={editing}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      )}

      {deleting && (
        <Modal
          title="Delete this booking?"
          onClose={closeDelete}
          busy={deleteBusy}
        >
          <div className="modal-b">
            {deleteError && (
              <div role="alert" className="err">
                {deleteError}
              </div>
            )}
            <p>
              {where(deleting)} on{" "}
              {formatWindow(deleting.startTime, deleting.endTime)} will be free
              again for others.
            </p>
          </div>
          <div className="modal-f">
            <button
              type="button"
              className="btn"
              onClick={closeDelete}
              disabled={deleteBusy}
            >
              Keep it
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void confirmDelete()}
              disabled={deleteBusy}
            >
              {deleteBusy ? "Deleting…" : "Delete booking"}
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
