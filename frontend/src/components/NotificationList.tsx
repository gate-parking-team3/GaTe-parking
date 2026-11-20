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
    } catch {
      // Ignore or log error
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
      <div role="alert">
        <p>{error}</p>
        <button type="button" onClick={handleRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (notifications === null) {
    return <p>Loading notifications…</p>;
  }

  if (notifications.length === 0) {
    return <p>You have no notifications.</p>;
  }

  return (
    <ul className="notification-list" aria-label="Notifications list">
      {notifications.map((item) => {
        const isUnread = !item.readAt;
        const badge = TYPE_BADGES[item.type] ?? item.type;
        const formattedDate = new Date(item.createdAt).toLocaleString();

        return (
          <li
            key={item.id}
            className={`notification-item ${isUnread ? "notification-item--unread" : "notification-item--read"}`}
          >
            <div className="notification-item__header">
              <span className="notification-item__badge">{badge}</span>
              <time
                dateTime={item.createdAt}
                className="notification-item__date"
              >
                {formattedDate}
              </time>
              {isUnread && (
                <span className="notification-item__status">Unread</span>
              )}
            </div>

            <h3 className="notification-item__title">{item.title}</h3>
            <p className="notification-item__message">{item.message}</p>

            <div className="notification-item__actions">
              <Link
                to={item.reservationUrl}
                className="notification-item__link"
                onClick={() => {
                  if (isUnread) handleMarkRead(item.id);
                }}
              >
                View reservation
              </Link>
              {isUnread && (
                <button
                  type="button"
                  className="notification-item__btn-read"
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
  );
}
