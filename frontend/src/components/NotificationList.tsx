import { useEffect, useState } from "react";
import { Link } from "react-router";
import { notificationApi } from "../api/notificationApi";
import type { NotificationRecord } from "../types/notification";

const TYPE_BADGES: Record<string, string> = {
  start_soon: "Starts soon",
  end_soon: "Ends soon",
  cancelled: "Cancelled",
  deleted: "Deleted",
  spot_unavailable: "Spot unavailable",
};

export default function NotificationList() {
  const [notifications, setNotifications] = useState<
    NotificationRecord[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let ignore = false;
    notificationApi.list().then(
      (data) => {
        if (!ignore) {
          setNotifications(data);
        }
      },
      (err: unknown) => {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load notifications.",
          );
        }
      },
    );
    return () => {
      ignore = true;
    };
  }, [reloadCount]);

  async function handleMarkRead(id: string) {
    setMarkingReadId(id);
    setMarkError(null);
    try {
      await notificationApi.markRead(id);
      setNotifications((current) =>
        current
          ? current.map((item) =>
              item.id === id
                ? { ...item, readAt: new Date().toISOString() }
                : item,
            )
          : null,
      );
    } catch (err) {
      setMarkError(
        err instanceof Error ? err.message : "Could not mark as read.",
      );
    } finally {
      setMarkingReadId(null);
    }
  }

  function handleRetry() {
    setError(null);
    setNotifications(null);
    setReloadCount((c) => c + 1);
  }

  if (error) {
    return (
      <div role="alert" className="err">
        <p>{error}</p>
        <button type="button" className="btn btn-sm" onClick={handleRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (notifications === null) {
    return <p className="muted">Loading notifications…</p>;
  }

  if (notifications.length === 0) {
    return (
      <section className="card">
        <div className="empty">
          <p>You have no notifications.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      {markError && (
        <div role="alert" className="err">
          {markError}
        </div>
      )}
      <ul className="card" aria-label="Notifications list">
        {notifications.map((item) => {
          const isUnread = !item.readAt;
          const badge = TYPE_BADGES[item.type] ?? item.type;
          const formattedDate = new Date(item.createdAt).toLocaleString();

          return (
            <li key={item.id} className="item">
              <div className="grow">
                <div className="item-t">
                  <h3>{item.title}</h3>
                </div>
                <div className="item-s">
                  <span className="pill gray">{badge}</span>
                  <time dateTime={item.createdAt} className="tabular">
                    {formattedDate}
                  </time>
                  {isUnread && <span className="pill blue">Unread</span>}
                </div>
                <p>{item.message}</p>
              </div>
              <div className="acts">
                <Link
                  to={item.reservationUrl}
                  className="btn btn-sm"
                  onClick={() => {
                    if (isUnread) handleMarkRead(item.id);
                  }}
                >
                  View reservation
                </Link>
                {isUnread && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={markingReadId === item.id}
                    onClick={() => handleMarkRead(item.id)}
                    aria-label={`Mark "${item.title}" as read`}
                  >
                    {markingReadId === item.id ? "Marking…" : "Mark as read"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
