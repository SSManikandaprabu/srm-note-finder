
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
  const socketRef = useRef(null);

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
        await fetch(`${API_BASE}/api/private-chat/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text }),
        });
        setMessage("");
        alert("Your private message was sent securely to the Admin!");
      } catch (err) {
        console.error("Private message send error:", err);
        alert("Failed to send message to admin. Please try again.");
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

  return (
    <section className="community-chat">
      <header className="community-chat__header">
        <div>
          <p className="community-chat__eyebrow">SRM NOTE FINDER</p>
          <h2>Student Community</h2>
          <p>Ask doubts, share ideas, and help fellow students.</p>
        </div>
        <span className="community-chat__status">{status}</span>
      </header>

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
            <span>💬</span>
            <h3>Your community starts here</h3>
            <p>Messages will appear here when community messaging is enabled.</p>
          </div>
        ) : (
          messages.map((item, index) => (
            <article
              className="community-chat__message"
              key={item.id || item._id || index}
            >
              <strong>{item.senderName || "Student"}</strong>
              <p>{item.text}</p>
            </article>
          ))
        )}
      </div>

      {studentEmail && (
        <div className="community-chat__login">
          <div className="community-chat__signed-in">
            <span>Signed in as {studentEmail}</span>
          </div>
        </div>
      )}

      {studentEmail ? (
        <form
          className="community-chat__composer"
          onSubmit={sendMessage}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px",
              borderRadius: "10px",
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setRecipient("everyone")}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                border: "none",
                background: recipient === "everyone" ? "linear-gradient(135deg, #06b6d4, #3b82f6)" : "transparent",
                color: recipient === "everyone" ? "#ffffff" : "#94a3b8",
                transition: "all 0.2s ease",
              }}
            >
              👥 Everyone
            </button>
            <button
              type="button"
              onClick={() => setRecipient("admin")}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                border: "none",
                background: recipient === "admin" ? "linear-gradient(135deg, #8b5cf6, #ec4899)" : "transparent",
                color: recipient === "admin" ? "#ffffff" : "#94a3b8",
                transition: "all 0.2s ease",
              }}
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
            disabled={!message.trim()}
          >
            {recipient === "admin" ? "Send to Admin" : "Send"}
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
