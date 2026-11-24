import { useEffect, useState } from "react";
import { adminApi } from "../api/adminApi";
import type { AuditLogEntry } from "../types/audit";

export default function ActivityHistory() {
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    adminApi.listAuditLogs().then(
      (data) => {
        if (!ignore) {
          setLogs(data.logs);
        }
      },
      (err: unknown) => {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load activity history.",
          );
        }
      },
    );
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  function handleRetry() {
    setError(null);
    setLogs(null);
    setReloadKey((k) => k + 1);
  }

  if (error) {
    return (
      <section aria-label="Activity History">
        <h1 className="page-heading">Activity History</h1>
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={handleRetry}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (logs === null) {
    return <p>Loading activity history…</p>;
  }

  return (
    <section aria-label="Activity History">
      <h1 className="page-heading">Activity History</h1>
      <p className="page-description">
        Audit log of administrative and system actions across all users.
      </p>

      {logs.length === 0 ? (
        <p>No activity logs recorded yet.</p>
      ) : (
        <table className="audit-log-table">
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>User</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>
                  <strong>{log.user.name}</strong>
                  <br />
                  <small>{log.user.email}</small>
                </td>
                <td>{log.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
