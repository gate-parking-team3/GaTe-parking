import { useState } from "react";
import NotificationList from "../components/NotificationList";
import NotificationSettingsForm from "../components/NotificationSettingsForm";

export default function Notifications() {
  const [activeTab, setActiveTab] = useState<"list" | "settings">("list");

  return (
    <section aria-label="Notifications Page">
      <h1 className="page-heading">Notifications</h1>
      <div
        className="tab-controls"
        role="tablist"
        aria-label="Notification views"
        style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "list"}
          className={`tab-btn ${activeTab === "list" ? "tab-btn--active" : ""}`}
          onClick={() => setActiveTab("list")}
        >
          My Notifications
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "settings"}
          className={`tab-btn ${activeTab === "settings" ? "tab-btn--active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          Notification Settings
        </button>
      </div>

      <div className="tab-content">
        {activeTab === "list" ? (
          <NotificationList />
        ) : (
          <NotificationSettingsForm />
        )}
      </div>
    </section>
  );
}
