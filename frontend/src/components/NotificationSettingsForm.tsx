import { useEffect, useState } from "react";
import { notificationApi } from "../api/notificationApi";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  type NotificationSettings,
  type NotificationType,
} from "../types/notification";

export default function NotificationSettingsForm() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<NotificationType | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let ignore = false;
    notificationApi.settings().then(
      (data) => {
        if (!ignore) {
          setSettings(data);
        }
      },
      (err: unknown) => {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load notification settings.",
          );
        }
      },
    );
    return () => {
      ignore = true;
    };
  }, [reloadCount]);

  async function handleToggle(type: NotificationType, newValue: boolean) {
    if (!settings) return;
    const previous = settings[type];
    setSavingType(type);
    setError(null);
    setFeedback(null);

    // Optimistic update
    setSettings({ ...settings, [type]: newValue });

    try {
      const updated = await notificationApi.updateSettings({
        [type]: newValue,
      });
      setSettings(updated);
      setFeedback("Preferences saved.");
    } catch (err) {
      // Revert optimistic update
      setSettings((current) =>
        current ? { ...current, [type]: previous } : null,
      );
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update notification settings.",
      );
    } finally {
      setSavingType(null);
    }
  }

  function handleRetry() {
    setError(null);
    setSettings(null);
    setReloadCount((c) => c + 1);
  }

  if (error && !settings) {
    return (
      <div role="alert" className="err">
        <p>{error}</p>
        <button type="button" className="btn btn-sm" onClick={handleRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (settings === null) {
    return <p className="muted">Loading notification settings…</p>;
  }

  const currentSettings = settings ?? DEFAULT_NOTIFICATION_SETTINGS;

  return (
    <section aria-label="Notification Preferences">
      <h2 className="section-title">Notification Preferences</h2>
      <p className="hint">
        Configure which automated notifications you would like to receive.
      </p>

      {error && (
        <div role="alert" className="err">
          {error}
        </div>
      )}
      {feedback && (
        <div role="status" className="ok-note">
          {feedback}
        </div>
      )}

      <form className="card" onSubmit={(e) => e.preventDefault()}>
        {NOTIFICATION_TYPES.map((type) => {
          const isEnabled = currentSettings[type];
          const isSaving = savingType === type;
          return (
            <label key={type} className="switch">
              <span>
                {NOTIFICATION_TYPE_LABELS[type]}
                {isSaving && <span className="hint"> Saving…</span>}
              </span>
              <input
                type="checkbox"
                checked={isEnabled}
                disabled={isSaving}
                onChange={(e) => handleToggle(type, e.target.checked)}
              />
            </label>
          );
        })}
      </form>
    </section>
  );
}
