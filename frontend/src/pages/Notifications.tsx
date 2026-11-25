import { useState } from "react";
import NotificationList from "../components/NotificationList";
import NotificationSettingsForm from "../components/NotificationSettingsForm";

export default function Notifications() {
  const [activeTab, setActiveTab] = useState<"list" | "settings">("list");

  return (
    <div className="page" aria-label="Notifications Page">
      <div className="head">
        <div>
          <h1>Notifications</h1>
          <p>Updates about your bookings and what you want to hear about.</p>
        </div>
      </div>

      <div className="seg" role="tablist" aria-label="Notification views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "list"}
          className={activeTab === "list" ? "on" : ""}
          onClick={() => setActiveTab("list")}
        >
          My Notifications
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "settings"}
          className={activeTab === "settings" ? "on" : ""}
          onClick={() => setActiveTab("settings")}
        >
          Notification Settings
        </button>
      </div>

      {activeTab === "list" ? (
        <NotificationList />
      ) : (
        <NotificationSettingsForm />
      )}
    </div>
  );
}
