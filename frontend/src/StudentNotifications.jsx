
import React, { useEffect, useRef, useState } from "react";
import "./StudentNotifications.css";

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  "http://localhost:5000";

const TYPE_LABELS = {
  toast: "QUICK UPDATE",
  banner: "CAMPUS ANNOUNCEMENT",
  modal: "IMPORTANT NOTICE",
  inline: "STUDY RESOURCE UPDATE",
  push: "BROWSER NOTIFICATION",
};

const VALID_TYPES = ["toast", "banner", "modal", "inline", "push"];
const VALID_THEMES = [
  "aurora-cyan",
  "royal-purple",
  "deep-ocean",
  "emerald",
  "neon",
  "glass",
  "minimal",
];

export default function StudentNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [closed, setClosed] = useState([]);
  const [permission, setPermission] = useState(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );

  const notifiedIds = useRef(new Set());

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      try {
        const response = await fetch(`${API_BASE}/api/notifications`);

        if (!response.ok) {
          throw new Error(`Notification API error: ${response.status}`);
        }

        const data = await response.json();

        if (active && data.success) {
          setNotifications(
            (data.notifications || []).filter(
              (item) => item.enabled && item.published
            )
          );
        }
      } catch (error) {
        console.error("Notification loading failed:", error);
      }
    }

    loadNotifications();
    const interval = window.setInterval(loadNotifications, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  function dismiss(id) {
    setClosed((previous) =>
      previous.includes(id) ? previous : [...previous, id]
    );
  }

  // Close modal notifications on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        const modalNotifications = notifications.filter(
          (n) => n.type === "modal" && !closed.includes(n._id)
        );
        if (modalNotifications.length > 0) {
          modalNotifications.forEach((n) => dismiss(n._id));
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [notifications, closed]);

  // Toast notifications disappear after five seconds.
  useEffect(() => {
    const timers = notifications
      .filter(
        (item) =>
          item.type === "toast" && !closed.includes(item._id)
      )
      .map((item) =>
        window.setTimeout(() => dismiss(item._id), 5000)
      );

    return () => timers.forEach(window.clearTimeout);
  }, [notifications, closed]);

  // Deliver browser notifications when permission has been granted.
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    notifications
      .filter((item) => item.type === "push")
      .forEach((item) => {
        if (notifiedIds.current.has(item._id)) return;

        notifiedIds.current.add(item._id);

        try {
          const browserNotification = new Notification(item.title, {
            body: item.message,
            tag: item._id,
          });

          browserNotification.onclick = () => {
            window.focus();
            browserNotification.close();
          };
        } catch (error) {
          console.error("Browser notification failed:", error);
        }
      });
  }, [notifications]);

  async function enablePush() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
    } catch (error) {
      console.error("Notification permission failed:", error);
    }
  }

  const visibleNotifications = notifications.filter(
    (item) => !closed.includes(item._id)
  );

  if (!visibleNotifications.length) return null;

  return (
    <div className="student-notifications">
      {visibleNotifications.map((item) => {
        const type = VALID_TYPES.includes(item.type)
          ? item.type
          : "banner";

        const theme = VALID_THEMES.includes(item.theme)
          ? item.theme
          : "neon";

        const label = TYPE_LABELS[type];

        if (type === "push") {
          // A real browser notification is separate from this permission card.
          if (permission === "granted") return null;

          return (
            <section
              key={item._id}
              className={`sn-card sn-push theme-${theme}`}
              role="status"
            >
              <div className="sn-push-icon" aria-hidden="true">
                🔔
              </div>

              <div className="sn-content">
                <div className="sn-label">BROWSER ALERTS</div>
                <h3>{item.title}</h3>
                <p>{item.message}</p>

                {permission === "default" && (
                  <button
                    type="button"
                    className="sn-enable"
                    onClick={enablePush}
                  >
                    Enable browser notifications
                  </button>
                )}

                {permission === "denied" && (
                  <p>
                    Notifications are blocked. Allow them in your
                    browser site settings.
                  </p>
                )}

                {permission === "unsupported" && (
                  <p>
                    Your browser does not support notifications.
                  </p>
                )}
              </div>

              <button
                type="button"
                className="sn-close"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item._id)}
              >
                ×
              </button>
            </section>
          );
        }

        const content = (
          <>
            <div className="sn-content">
              <div className="sn-label">{label}</div>
              <h3>{item.title}</h3>
              <p>{item.message}</p>

              {item.actionText && (
                <span className="sn-action">
                  {item.actionText} →
                </span>
              )}
            </div>

            <button
              type="button"
              className="sn-close"
              aria-label="Dismiss notification"
              onClick={() => dismiss(item._id)}
            >
              ×
            </button>
          </>
        );

        if (type === "modal") {
          return (
            <div
              className="sn-modal-overlay"
              key={item._id}
              onClick={(e) => {
                if (e.target === e.currentTarget) dismiss(item._id);
              }}
            >
              <section
                className={`sn-card sn-modal theme-${theme}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`sn-title-${item._id}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sn-modal-icon" aria-hidden="true">
                  ✦
                </div>

                <div className="sn-content">
                  <div className="sn-label">{label}</div>
                  <h3 id={`sn-title-${item._id}`}>{item.title}</h3>
                  <p>{item.message}</p>

                  {item.actionText && (
                    <button
                      type="button"
                      className="sn-enable"
                      onClick={() => dismiss(item._id)}
                    >
                      {item.actionText}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="sn-close"
                  aria-label="Close popup"
                  onClick={() => dismiss(item._id)}
                >
                  ×
                </button>
              </section>
            </div>
          );
        }

        return (
          <section
            key={item._id}
            className={`sn-card sn-${type} theme-${theme}`}
            role="status"
          >
            {type === "banner" && (
              <div className="sn-banner-icon" aria-hidden="true">
                📢
              </div>
            )}
            {content}
          </section>
        );
      })}
    </div>
  );
}
