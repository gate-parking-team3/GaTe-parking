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
      <div className="page" aria-label="Activity History">
        <div className="head">
          <div>
            <h1>Activity History</h1>
          </div>
        </div>
        <div role="alert" className="err">
          <p>{error}</p>
          <button type="button" className="btn btn-sm" onClick={handleRetry}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (logs === null) {
    return (
      <div className="page">
        <p className="muted">Loading activity history…</p>
      </div>
    );
  }

  return (
    <div className="page" aria-label="Activity History">
      <div className="head">
        <div>
          <h1>Activity History</h1>
          <p>
            Audit log of administrative and system actions across all users.
          </p>
        </div>
      </div>

      {logs.length === 0 ? (
        <section className="card">
          <div className="empty">
            <p>No activity logs recorded yet.</p>
          </div>
        </section>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>User</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="tabular">
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                  <td>
                    <strong>{log.user.name}</strong>
                    <span className="sub">{log.user.email}</span>
                  </td>
                  <td>{log.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
