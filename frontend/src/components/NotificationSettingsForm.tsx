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
      <div role="alert">
        <p>{error}</p>
        <button type="button" onClick={handleRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (settings === null) {
    return <p>Loading notification settings…</p>;
  }

  const currentSettings = settings ?? DEFAULT_NOTIFICATION_SETTINGS;

  return (
    <section aria-label="Notification Preferences">
      <h2>Notification Preferences</h2>
      <p>Configure which automated notifications you would like to receive.</p>

      {error && <p role="alert">{error}</p>}
      {feedback && <p role="status">{feedback}</p>}

      <form onSubmit={(e) => e.preventDefault()}>
        {NOTIFICATION_TYPES.map((type) => {
          const isEnabled = currentSettings[type];
          const isSaving = savingType === type;
          return (
            <div key={type} className="notification-setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  disabled={isSaving}
                  onChange={(e) => handleToggle(type, e.target.checked)}
                />
                {" " + NOTIFICATION_TYPE_LABELS[type]}
              </label>
              {isSaving && <span> Saving…</span>}
            </div>
          );
        })}
      </form>
    </section>
  );
}
