
import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import "./CommunityChat.css";

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  "http://localhost:5000";

export default function CommunityChat({
  studentEmail: propStudentEmail,
  onStudentLogin,
  onOpenPrivateMessages,
}) {
  const studentEmail =
    propStudentEmail ||
    localStorage.getItem("srm-student-email") ||
    localStorage.getItem("student-email") ||
    "";

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Connecting...");
  const [recipient, setRecipient] = useState("everyone");
  const [adminNotice, setAdminNotice] = useState(null);
  const [isSendingAdmin, setIsSendingAdmin] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (studentEmail && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, studentEmail]);

  useEffect(() => {
    if (!adminNotice) return;
    const timer = setTimeout(() => setAdminNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [adminNotice]);

  useEffect(() => {
    const token = localStorage.getItem("srm-student-token");

    if (!token) {
      setMessages([]);
      setStatus("Sign in required");
      return;
    }

    const socket = io(API_BASE, {
      auth: { token },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("Connected");
      socket.emit("community:load", { token });
    });

    socket.on("disconnect", () => {
      setStatus("Disconnected");
    });

    socket.on("chat:error", (error) => {
      setStatus(error?.message || "Chat error");
    });

    socket.on("community:history", (history) => {
      setMessages(Array.isArray(history) ? history : []);
    });

    socket.on("community:message", (newMessage) => {
      setMessages((previous) => {
        if (
          previous.some(
            (item) =>
              item._id &&
              newMessage._id &&
              item._id === newMessage._id
          )
        ) {
          return previous;
        }

        return [...previous, newMessage];
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [studentEmail]);

  async function sendMessage(event) {
    event.preventDefault();

    const text = message.trim();
    if (!text) return;

    const token = localStorage.getItem("srm-student-token");
    if (!token) {
      setStatus("Please sign in first");
      return;
    }

    if (recipient === "admin") {
      try {
        setIsSendingAdmin(true);
        const res = await fetch(`${API_BASE}/api/private-chat/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) {
          throw new Error("Failed to deliver private message");
        }
        setMessage("");
        setAdminNotice({
          type: "success",
          text: "Private message delivered securely to Admin.",
        });
      } catch (err) {
        console.error("Private message send error:", err);
        setAdminNotice({
          type: "error",
          text: "Could not send message to Admin. Please try again.",
        });
      } finally {
        setIsSendingAdmin(false);
      }
      return;
    }

    const socket = socketRef.current;

    if (!socket?.connected) {
      setStatus("Disconnected");
      return;
    }

    socket.emit("community:send", { text, token });
    setMessage("");
  }

  const isConnected = status.toLowerCase().includes("connected") && !status.toLowerCase().includes("dis");
  const isLocked = status.toLowerCase().includes("sign in");
  const statusClass = isConnected
    ? "community-chat__status--connected"
    : isLocked
      ? "community-chat__status--locked"
      : "community-chat__status--offline";

  const getInitials = (name = "Student") => {
    const parts = String(name).trim().split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return "ST";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const getAvatarHue = (name = "") => {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 5;
  };

  const formatTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const emailHandle = studentEmail ? studentEmail.split("@")[0].toLowerCase() : "";

  return (
    <section className="community-chat">
      <header className="community-chat__header">
        <div className="community-chat__title-group">
          <p className="community-chat__eyebrow">SRM NOTE FINDER • LIVE LOUNGE</p>
          <h2>Student Community</h2>
          <p>Ask doubts, share notes & ideas, or message Admin privately.</p>
        </div>
        <div className="community-chat__header-meta">
          {studentEmail && messages.length > 0 && (
            <span className="community-chat__count-pill">
              {messages.length} {messages.length === 1 ? "message" : "messages"}
            </span>
          )}
          <span className={`community-chat__status ${statusClass}`}>
            <span className="community-chat__status-dot" aria-hidden="true" />
            {status}
          </span>
        </div>
      </header>

      {adminNotice && (
        <div
          className={`community-chat__toast community-chat__toast--${adminNotice.type}`}
          role="status"
        >
          <span>{adminNotice.type === "success" ? "✓" : "!"}</span>
          <span>{adminNotice.text}</span>
          {adminNotice.type === "success" && onOpenPrivateMessages && (
            <button
              type="button"
              className="community-chat__toast-link"
              onClick={onOpenPrivateMessages}
            >
              Open Inbox →
            </button>
          )}
        </div>
      )}

      <div className="community-chat__messages">
        {!studentEmail ? (
          <div
            className="community-chat__empty community-chat__locked"
            style={{
              margin: "auto",
              padding: "48px 32px",
              maxWidth: "460px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* Ambient glowing lock badge */}
            <div
              style={{
                position: "relative",
                width: "74px",
                height: "74px",
                marginBottom: "20px",
                borderRadius: "22px",
                background: "linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(139, 92, 246, 0.25))",
                border: "1px solid rgba(103, 232, 249, 0.35)",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 0 35px rgba(34, 211, 238, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>

            <div
              style={{
                display: "inline-block",
                padding: "4px 12px",
                marginBottom: "12px",
                borderRadius: "999px",
                background: "rgba(34, 211, 238, 0.1)",
                border: "1px solid rgba(34, 211, 238, 0.25)",
                color: "#67e8f9",
                fontSize: "11px",
                fontWeight: "800",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              Verified Student Access
            </div>

            <h3
              style={{
                fontSize: "22px",
                fontWeight: "800",
                letterSpacing: "-0.5px",
                color: "#f8fafc",
                margin: "0 0 10px",
              }}
            >
              Community Chat is Locked
            </h3>

            <p
              style={{
                color: "#94a3b8",
                fontSize: "14px",
                lineHeight: "1.65",
                maxWidth: "360px",
                margin: "0 0 24px",
              }}
            >
              Join your fellow students to ask questions, share study resources, and get quick answers.
            </p>

            <button
              type="button"
              onClick={onStudentLogin}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                padding: "13px 32px",
                borderRadius: "14px",
                border: "1px solid rgba(255, 255, 255, 0.35)",
                background: "linear-gradient(110deg, #22d3ee, #06b6d4 45%, #8b5cf6)",
                color: "#04101e",
                fontWeight: "800",
                fontSize: "14px",
                cursor: "pointer",
                boxShadow: "0 8px 28px rgba(34, 211, 238, 0.3)",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 12px 34px rgba(34, 211, 238, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 8px 28px rgba(34, 211, 238, 0.3)";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
              </svg>
              <span>Sign in to Unlock Chat</span>
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="community-chat__empty">
            <div className="community-chat__empty-icon">💬</div>
            <h3>Start the conversation</h3>
            <p>Be the first to ask a doubt, share a study tip, or say hello.</p>
          </div>
        ) : (
          <>
            {messages.map((item, index) => {
              const senderName = item.senderName || "Student";
              const isSelf = Boolean(
                studentEmail &&
                  ((item.senderEmail &&
                    item.senderEmail.toLowerCase() === studentEmail.toLowerCase()) ||
                    senderName.toLowerCase() === emailHandle)
              );
              const timestamp = formatTime(item.createdAt || item.timestamp);
              const hue = getAvatarHue(senderName);

              return (
                <div
                  className={`community-chat__message-row ${
                    isSelf
                      ? "community-chat__message-row--self"
                      : "community-chat__message-row--other"
                  }`}
                  key={item.id || item._id || index}
                >
                  {!isSelf && (
                    <div
                      className={`community-chat__avatar community-chat__avatar--tone-${hue}`}
                      aria-hidden="true"
                    >
                      {getInitials(senderName)}
                    </div>
                  )}
                  <article
                    className={`community-chat__message ${
                      isSelf ? "community-chat__message--self" : ""
                    }`}
                  >
                    <div className="community-chat__message-meta">
                      <strong>{isSelf ? "You" : senderName}</strong>
                      {timestamp && (
                        <time className="community-chat__time">{timestamp}</time>
                      )}
                    </div>
                    <p>{item.text}</p>
                  </article>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {studentEmail && (
        <div className="community-chat__login">
          <div className="community-chat__signed-in">
            <span>Signed in as {studentEmail}</span>
            {onOpenPrivateMessages && (
              <button
                type="button"
                className="community-chat__inbox-btn"
                onClick={onOpenPrivateMessages}
              >
                🔒 Private Inbox
              </button>
            )}
          </div>
        </div>
      )}

      {studentEmail ? (
        <form
          className="community-chat__composer"
          onSubmit={sendMessage}
        >
          <div className="community-chat__recipient-toggle" role="group" aria-label="Message recipient">
            <button
              type="button"
              onClick={() => setRecipient("everyone")}
              className={`community-chat__recipient-btn ${
                recipient === "everyone" ? "is-active-everyone" : ""
              }`}
            >
              👥 Everyone
            </button>
            <button
              type="button"
              onClick={() => setRecipient("admin")}
              className={`community-chat__recipient-btn ${
                recipient === "admin" ? "is-active-admin" : ""
              }`}
            >
              🔒 Admin
            </button>
          </div>

          <input
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            placeholder={
              recipient === "admin"
                ? "Send private message directly to Admin..."
                : "Write a public message to everyone..."
            }
            maxLength={2000}
            aria-label="Community message"
          />

          <button
            type="submit"
            className={`community-chat__send-btn ${
              recipient === "admin" ? "community-chat__send-btn--admin" : ""
            }`}
            disabled={!message.trim() || isSendingAdmin}
          >
            {isSendingAdmin
              ? "Sending..."
              : recipient === "admin"
                ? "Send to Admin"
                : "Send"}
          </button>
        </form>
      ) : (
        <div
          style={{
            padding: "14px 20px",
            borderRadius: "14px",
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px dashed rgba(148, 163, 184, 0.2)",
            textAlign: "center",
            color: "#64748b",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <span>🔒</span>
          <span>Sign in with your @srmist.edu.in email to unlock the message composer.</span>
        </div>
      )}
    </section>
  );
}
