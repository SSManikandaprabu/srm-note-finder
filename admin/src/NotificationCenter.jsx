
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./NotificationCenter.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const TYPES = [
  {
    id: "toast",
    label: "Toast",
    description: "A small floating notification that automatically disappears after a short time.",
    example: "“New notes uploaded successfully!”",
  },
  {
    id: "banner",
    label: "Banner",
    description: "A full-width strip at the top of the website for important announcements.",
    example: "“Semester exams begin next week.”",
  },
  {
    id: "modal",
    label: "Modal",
    description: "A centered popup with a backdrop, useful for announcements that require attention.",
    example: "“Important: Updated exam timetable.”",
  },
  {
    id: "inline",
    label: "Inline",
    description: "An announcement displayed directly within a page or section.",
    example: "“New Machine Learning notes are available.”",
  },
  {
    id: "push",
    label: "Push notification",
    description: "A browser notification outside the website, subject to user permission and browser support.",
    example: "“A new announcement has been published.”",
  },
];

const THEMES = [
  {
    id: "aurora-cyan",
    label: "Aurora Cyan",
    description: "Cyan accents with an aurora-inspired premium look.",
    color: "#22d3ee",
  },
  {
    id: "royal-purple",
    label: "Royal Purple",
    description: "Purple accents with a modern, elegant appearance.",
    color: "#a78bfa",
  },
  {
    id: "deep-ocean",
    label: "Deep Ocean",
    description: "Deep blue tones for a sleek interface.",
    color: "#38bdf8",
  },
  {
    id: "emerald",
    label: "Emerald",
    description: "Green accents for a fresh, clean style.",
    color: "#34d399",
  },
  {
    id: "glass",
    label: "Glassmorphism",
    description: "Translucent backdrop with frosted glass effect.",
    color: "#94a3b8",
  },
  {
    id: "minimal",
    label: "Clean Minimal",
    description: "High contrast crisp light/dark styling.",
    color: "#e2e8f0",
  },
];

const DEFAULT_SETTINGS = {
  enabled: {
    toast: true,
    banner: true,
    modal: true,
    inline: true,
    push: false,
  },
  type: "toast",
  theme: "aurora-cyan",
  position: "top-right",
  animation: "slide",
  duration: 5,
  title: "New notes uploaded successfully!",
  message: "Check the Semester 4 section for new notes and PYQs.",
  actionText: "View update",
};

function loadSettings() {
  try {
    const saved = localStorage.getItem("srm-notification-settings");

    if (!saved) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(saved);

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      enabled: {
        ...DEFAULT_SETTINGS.enabled,
        ...(parsed.enabled || {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function toLocalDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 16);
}

function getMinimumDateTime() {
  const date = new Date(Date.now() + 60000);

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 16);
}

export default function NotificationCenter() {
  const [settings, setSettings] = useState(loadSettings);
  const [preview, setPreview] = useState(false);
  const [scheduleMode, setScheduleMode] = useState("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverNotifications, setServerNotifications] = useState([]);
  const [loadingServerList, setLoadingServerList] = useState(false);

  const [notificationId, setNotificationId] = useState(
    () => localStorage.getItem("srm-notification-id")
  );

  // Load latest active notifications from server on mount
  useEffect(() => {
    loadServerNotifications();
  }, []);

  async function loadServerNotifications() {
    setLoadingServerList(true);
    try {
      const token = localStorage.getItem("srm-admin-token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API_BASE}/api/admin/notifications`, { headers });
      if (response.data?.success) {
        setServerNotifications(response.data.notifications || []);
      }
    } catch (err) {
      // Fallback to public route if token expired
      try {
        const publicRes = await axios.get(`${API_BASE}/api/notifications`);
        if (publicRes.data?.success) {
          setServerNotifications(publicRes.data.notifications || []);
        }
      } catch (e) {
        console.error("Failed to load notifications from backend:", e);
      }
    } finally {
      setLoadingServerList(false);
    }
  }

  function update(key, value) {
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));

    setSaved(false);
  }

  function toggleType(id, enabled) {
    setSettings((previous) => ({
      ...previous,
      enabled: {
        ...previous.enabled,
        [id]: enabled,
      },
    }));

    setSaved(false);
  }

  async function toggleServerNotification(notif) {
    const token = localStorage.getItem("srm-admin-token");
    if (!token) {
      alert("Admin login token not found. Please log in again.");
      return;
    }

    try {
      const newEnabled = !notif.enabled;
      await axios.patch(
        `${API_BASE}/api/admin/notifications/${notif._id}`,
        { enabled: newEnabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadServerNotifications();
    } catch (err) {
      alert("Failed to toggle notification: " + (err.response?.data?.message || err.message));
    }
  }

  async function deleteServerNotification(id) {
    if (!window.confirm("Are you sure you want to delete this notification?")) return;
    const token = localStorage.getItem("srm-admin-token");
    if (!token) {
      alert("Admin login token not found. Please log in again.");
      return;
    }

    try {
      await axios.delete(`${API_BASE}/api/admin/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (notificationId === id) {
        setNotificationId(null);
        localStorage.removeItem("srm-notification-id");
      }
      loadServerNotifications();
    } catch (err) {
      alert("Failed to delete notification: " + (err.response?.data?.message || err.message));
    }
  }

  async function saveSettings() {
    if (saving) return;

    const token = localStorage.getItem("srm-admin-token");

    if (!token) {
      alert("Admin login token not found. Please log in again.");
      return;
    }

    if (!settings.title.trim() || !settings.message.trim()) {
      alert("Please enter a notification title and message.");
      return;
    }

    let scheduledDate = null;

    if (scheduleMode === "schedule") {
      if (!scheduledAt) {
        alert("Please select a date and time.");
        return;
      }

      scheduledDate = new Date(scheduledAt);

      if (
        Number.isNaN(scheduledDate.getTime()) ||
        scheduledDate.getTime() <= Date.now()
      ) {
        alert("Please select a future date and time.");
        return;
      }
    }

    const payload = {
      title: settings.title.trim(),
      message: settings.message.trim(),
      type: settings.type,
      theme: settings.theme,
      actionText: settings.actionText.trim(),
      enabled: settings.enabled[settings.type],
      published: true,
      scheduledAt: scheduledDate
        ? scheduledDate.toISOString()
        : null,
    };

    setSaving(true);
    setSaved(false);

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      let response;

      if (notificationId) {
        response = await axios.patch(
          `${API_BASE}/api/admin/notifications/${notificationId}`,
          payload,
          config
        );
      } else {
        response = await axios.post(
          `${API_BASE}/api/admin/notifications`,
          payload,
          config
        );
      }

      const id = response.data?.notification?._id || notificationId;

      if (id) {
        setNotificationId(id);
        localStorage.setItem("srm-notification-id", id);
      }

      localStorage.setItem(
        "srm-notification-settings",
        JSON.stringify(settings)
      );

      setSaved(true);
      loadServerNotifications();

      alert(
        scheduledDate
          ? `Notification scheduled for ${scheduledDate.toLocaleString()}.`
          : "Notification published successfully!"
      );
    } catch (error) {
      console.error("Save notification error:", error);

      alert(
        error.response?.data?.message ||
          "Unable to save. Check the backend and admin login."
      );
    } finally {
      setSaving(false);
    }
  }

  async function requestPushPermission() {
    if (!("Notification" in window)) {
      alert("Browser notifications are not supported in this browser.");
      return;
    }

    try {
      const permission = await window.Notification.requestPermission();

      if (permission === "granted") {
        new window.Notification(settings.title, {
          body: settings.message,
        });

        alert("Test browser notification sent.");
      } else {
        alert("Notification permission was not granted.");
      }
    } catch (error) {
      console.error("Browser notification error:", error);
      alert("Could not send the browser notification.");
    }
  }

  function testNotification() {
    if (!settings.enabled[settings.type]) {
      alert("Enable this notification type first.");
      return;
    }

    if (settings.type === "push") {
      void requestPushPermission();
      return;
    }

    setPreview(true);

    if (settings.type === "toast") {
      window.setTimeout(() => setPreview(false), settings.duration * 1000);
    }
  }

  return (
    <div className="nc-page">
      <header className="nc-header">
        <div>
          <div className="nc-eyebrow">SRM NOTE FINDER / ADMIN</div>
          <h1>Notification Center</h1>
          <p>Configure, customize and preview your notifications.</p>
        </div>

        <span className="nc-status">
          <span className="nc-status-dot" />
          Control panel
        </span>
      </header>

      <section className="nc-type-grid">
        {TYPES.map((type) => (
          <button
            type="button"
            key={type.id}
            className={`nc-type-card ${
              settings.type === type.id ? "selected" : ""
            }`}
            onClick={() => {
              update("type", type.id);
              setPreview(false);
            }}
          >
            <span className="nc-type-icon">
              {({
                toast: "◈",
                banner: "▰",
                modal: "▣",
                inline: "☰",
                push: "♧",
              })[type.id]}
            </span>

            <strong>{type.label}</strong>
            <small>{type.description}</small>
            {type.example && (
              <span className="nc-type-example">
                <em>Ex: {type.example}</em>
              </span>
            )}

            <span
              className={`nc-switch ${
                settings.enabled[type.id] ? "on" : ""
              }`}
            >
              {settings.enabled[type.id] ? "Enabled" : "Disabled"}
            </span>
          </button>
        ))}
      </section>

      <div className="nc-layout">
        <section className="nc-panel">
          <div className="nc-panel-heading">
            <div>
              <h2>Configuration</h2>
              <p>Customize the selected notification.</p>
            </div>
          </div>

          <label className="nc-field">
            <span>Notification enabled</span>
            <select
              value={String(settings.enabled[settings.type])}
              onChange={(event) =>
                toggleType(settings.type, event.target.value === "true")
              }
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </label>

          <label className="nc-field">
            <span>Visual theme</span>
            <select
              value={settings.theme}
              onChange={(event) => update("theme", event.target.value)}
            >
              {THEMES.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.label}
                </option>
              ))}
            </select>
          </label>

          {(settings.type === "toast" || settings.type === "modal") && (
            <label className="nc-field">
              <span>Position</span>
              <select
                value={settings.position}
                onChange={(event) => update("position", event.target.value)}
              >
                <option value="top-right">Top right</option>
                <option value="top-center">Top center</option>
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-center">Bottom center</option>
              </select>
            </label>
          )}

          <label className="nc-field">
            <span>Animation</span>
            <select
              value={settings.animation}
              onChange={(event) => update("animation", event.target.value)}
            >
              <option value="slide">Slide</option>
              <option value="fade">Fade</option>
              <option value="scale">Scale</option>
              <option value="none">None</option>
            </select>
          </label>

          <label className="nc-field">
            <span>Duration: {settings.duration} seconds</span>
            <input
              type="range"
              min="2"
              max="15"
              value={settings.duration}
              onChange={(event) =>
                update("duration", Number(event.target.value))
              }
            />
          </label>

          <label className="nc-field">
            <span>Title</span>
            <input
              value={settings.title}
              maxLength={100}
              onChange={(event) => update("title", event.target.value)}
            />
          </label>

          <label className="nc-field">
            <span>Message</span>
            <textarea
              value={settings.message}
              rows={3}
              maxLength={500}
              onChange={(event) => update("message", event.target.value)}
            />
          </label>

          <label className="nc-field">
            <span>Action button text (optional)</span>
            <input
              value={settings.actionText}
              maxLength={40}
              onChange={(event) => update("actionText", event.target.value)}
            />
          </label>

          <div className="nc-field">
            <span>When should this notification appear?</span>
            <select
              value={scheduleMode}
              onChange={(event) => {
                setScheduleMode(event.target.value);
                setSaved(false);
              }}
            >
              <option value="now">Publish immediately</option>
              <option value="schedule">Schedule for later</option>
            </select>
          </div>

          {scheduleMode === "schedule" && (
            <label className="nc-field">
              <span>Scheduled date and time</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                min={getMinimumDateTime()}
                onChange={(event) => {
                  setScheduledAt(event.target.value);
                  setSaved(false);
                }}
                required
              />
              <small>Uses your computer's local time.</small>
            </label>
          )}

          <div className="nc-actions">
            <button
              className="nc-button secondary"
              onClick={testNotification}
              type="button"
            >
              Test notification
            </button>

            <button
              className="nc-button primary"
              onClick={saveSettings}
              type="button"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>

          {saved && (
            <p className="nc-saved">
              Notification saved successfully.
            </p>
          )}
        </section>

        <section className="nc-panel nc-preview-panel">
          <div className="nc-panel-heading">
            <div>
              <h2>Live preview</h2>
              <p>Preview the selected design before saving.</p>
            </div>
            <span className="nc-preview-badge">PREVIEW</span>
          </div>

          <div className={`nc-stage theme-${settings.theme}`}>
            {settings.type === "banner" && (
              <div className="nc-banner">
                <span>✦</span>
                <div>
                  <strong>{settings.title}</strong>
                  <p>{settings.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreview(false)}
                  aria-label="Close banner preview"
                >
                  ×
                </button>
              </div>
            )}

            {settings.type === "inline" && (
              <div className="nc-inline">
                <span className="nc-preview-icon">ⓘ</span>
                <div>
                  <strong>{settings.title}</strong>
                  <p>{settings.message}</p>
                  {settings.actionText && (
                    <button type="button" onClick={() => setPreview(false)}>
                      {settings.actionText}
                    </button>
                  )}
                </div>
              </div>
            )}

            {settings.type === "modal" && (
              <div className="nc-modal">
                <button
                  className="nc-close"
                  type="button"
                  onClick={() => setPreview(false)}
                  aria-label="Close modal preview"
                >
                  ×
                </button>
                <span className="nc-modal-icon">✦</span>
                <h3>{settings.title}</h3>
                <p>{settings.message}</p>
                {settings.actionText && (
                  <button
                    className="nc-button primary"
                    type="button"
                    onClick={() => setPreview(false)}
                  >
                    {settings.actionText}
                  </button>
                )}
              </div>
            )}

            {settings.type === "toast" && (
              <div
                className={`nc-toast ${preview ? "show" : ""} ${
                  settings.animation === "none" ? "no-animation" : ""
                }`}
              >
                <span className="nc-toast-icon">✓</span>
                <div>
                  <strong>{settings.title}</strong>
                  <p>{settings.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreview(false)}
                  aria-label="Close toast preview"
                >
                  ×
                </button>
              </div>
            )}

            {settings.type === "push" && (
              <div className="nc-push">
                <div className="nc-push-top">
                  <span>◈ SRM NOTE FINDER</span>
                  <span>now</span>
                </div>
                <strong>{settings.title}</strong>
                <p>{settings.message}</p>
                <small>
                  Browser permission is required for a real notification.
                </small>
              </div>
            )}

            {!preview && settings.type === "toast" && (
              <div className="nc-placeholder">
                Your toast preview will appear here.
              </div>
            )}
          </div>

          <div className="nc-preview-footer">
            <span>Selected: {settings.type.toUpperCase()}</span>
            <button
              className="nc-button secondary"
              type="button"
              onClick={testNotification}
            >
              Run preview
            </button>
          </div>

          <p className="nc-note">
            Save and publish your notification, then check the student website.
          </p>
        </section>
      </div>

      {/* ACTIVE & PUBLISHED ANNOUNCEMENTS TABLE */}
      <section className="nc-panel" style={{ marginTop: "24px" }}>
        <div className="nc-panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>Live Announcements ({serverNotifications.length})</h2>
            <p>Directly turn ON or OFF any notification live on SRM Note Finder.</p>
          </div>
          <button
            type="button"
            className="nc-button secondary"
            onClick={loadServerNotifications}
            disabled={loadingServerList}
            style={{ fontSize: "12px", padding: "6px 14px" }}
          >
            {loadingServerList ? "Refreshing..." : "↻ Refresh List"}
          </button>
        </div>

        {serverNotifications.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>
            No active announcements currently running. Create one above to display on SRM Note Finder.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
            {serverNotifications.map((n) => (
              <div
                key={n._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  padding: "16px 20px",
                  borderRadius: "14px",
                  background: n.enabled ? "rgba(34, 211, 238, 0.05)" : "rgba(255, 255, 255, 0.02)",
                  border: n.enabled ? "1px solid rgba(34, 211, 238, 0.3)" : "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: "900",
                        textTransform: "uppercase",
                        background: "rgba(56, 189, 248, 0.15)",
                        color: "#38bdf8",
                      }}
                    >
                      {n.type}
                    </span>
                    <strong style={{ color: "#f8fafc", fontSize: "14px" }}>{n.title}</strong>
                  </div>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px", lineHeight: "1.4" }}>
                    {n.message}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => toggleServerNotification(n)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "10px",
                      border: "none",
                      fontWeight: "800",
                      fontSize: "12px",
                      cursor: "pointer",
                      background: n.enabled ? "#10b981" : "#475569",
                      color: "#ffffff",
                      boxShadow: n.enabled ? "0 0 12px rgba(16, 185, 129, 0.4)" : "none",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {n.enabled ? "● ON (Active)" : "○ OFF (Disabled)"}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteServerNotification(n._id)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "10px",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      background: "rgba(239, 68, 68, 0.1)",
                      color: "#ef4444",
                      fontWeight: "700",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}