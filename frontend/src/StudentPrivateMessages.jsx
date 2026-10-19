
import { useEffect, useState } from "react";
import axios from "axios";
import "./StudentPrivateMessages.css";

const API_BASE =
  (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

export default function StudentPrivateMessages({ studentToken, studentEmail }) {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${studentToken}`,
    },
  };

  async function loadMessages() {
    try {
      const response = await axios.get(
        `${API_BASE}/api/private-chat/messages`,
        authHeaders
      );

      setMessages(response.data.messages || []);
      setError("");
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Your login session has expired. Please sign out and sign in again.");
      } else {
        setError(
          err.response?.data?.message ||
            "Unable to load your private messages."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!studentToken) {
      setLoading(false);
      return;
    }

    loadMessages();

    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [studentToken]);

  async function sendMessage(event) {
    event.preventDefault();

    const text = message.trim();
    if (!text || sending) return;

    setSending(true);
    setError("");

    try {
      const response = await axios.post(
        `${API_BASE}/api/private-chat/messages`,
        { text },
        authHeaders
      );

      if (response.data.message) {
        setMessages((previous) => [
          ...previous,
          response.data.message,
        ]);
      } else {
        await loadMessages();
      }

      setMessage("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to send your private message."
      );
    } finally {
      setSending(false);
    }
  }

  if (!studentToken) {
    return (
      <section className="student-private-chat">
        <h2>Private Messages</h2>
        <p>Sign in with your verified SRM student account to view private messages from the admin.</p>
      </section>
    );
  }

  return (
    <section className="student-private-chat">
      <header className="student-private-chat__header">
        <div>
          <span className="student-private-chat__eyebrow">
            SECURE STUDENT INBOX
          </span>
          <h2>Private Messages</h2>
          <p>{studentEmail}</p>
        </div>
        <span className="student-private-chat__badge">
          Private
        </span>
      </header>

      <div className="student-private-chat__history">
        {loading ? (
          <p className="student-private-chat__empty">
            Loading your messages...
          </p>
        ) : messages.length === 0 ? (
          <div className="student-private-chat__empty">
            <span>✉️</span>
            <h3>Your private inbox is ready</h3>
            <p>Messages from the SRM Note Finder admin will appear here.</p>
          </div>
        ) : (
          messages.map((item, index) => (
            <article
              className={`student-private-chat__message ${
                item.senderId === "admin" ? "from-admin" : "from-student"
              }`}
              key={item._id || index}
            >
              <strong>
                {item.senderId === "admin"
                  ? "SRM Note Finder Admin"
                  : "You"}
              </strong>
              <p>{item.text}</p>
              <time>
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleString()
                  : ""}
              </time>
            </article>
          ))
        )}
      </div>

      {error && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "10px 0" }}>
          <p className="student-private-chat__error" style={{ margin: 0 }}>
            {error}
          </p>
          {error.includes("expired") && (
            <button
              type="button"
              className="pyq-filter-btn active"
              style={{ alignSelf: "flex-start", padding: "6px 12px" }}
              onClick={() => {
                localStorage.removeItem("srm-student-token");
                window.location.reload();
              }}
            >
              🔄 Refresh & Sign In Again
            </button>
          )}
        </div>
      )}

      <form
        className="student-private-chat__composer"
        onSubmit={sendMessage}
      >
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Write a private message..."
          maxLength={2000}
          aria-label="Private message"
          required
        />
        <button disabled={!message.trim() || sending} type="submit">
          {sending ? "Sending..." : "Send"}
        </button>
      </form>

      <p className="student-private-chat__note">
        Messages are intended for private communication with the admin.
        They are scheduled to expire after 7 days.
      </p>
    </section>
  );
}
