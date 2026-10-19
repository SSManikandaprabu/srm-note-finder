
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import "./PrivateMessagesPage.css";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api/private-chat";

export default function PrivateMessagesPage() {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockDuration, setBlockDuration] = useState("10m");
  const [blockScope, setBlockScope] = useState("all_chat");
  const [blockReason, setBlockReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const messagesEndRef = useRef(null);

  function getAuthHeaders() {
    const token = localStorage.getItem("srm-admin-token");
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadStudents() {
    try {
      const response = await axios.get(
        `${API_BASE}/students`,
        getAuthHeaders()
      );
      setStudents(response.data.students || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load verified students. Please sign in again if your session expired."
      );
    } finally {
      setLoadingStudents(false);
    }
  }

  async function handleApplyBlock() {
    if (!selectedStudent?._id) return;
    setActionLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE}/admin/${selectedStudent._id}/block`,
        {
          duration: blockDuration,
          scope: blockScope,
          reason: blockReason.trim() || "Violation of chat guidelines",
        },
        getAuthHeaders()
      );
      setNotice(response.data.message || "Student restricted successfully.");
      setShowBlockModal(false);
      setSelectedStudent(response.data.student);
      loadStudents();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to block student.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnblock() {
    if (!selectedStudent?._id) return;
    if (!window.confirm(`Unblock ${selectedStudent.username || selectedStudent.email}?`)) return;
    setActionLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE}/admin/${selectedStudent._id}/unblock`,
        {},
        getAuthHeaders()
      );
      setNotice("Student restriction lifted.");
      setSelectedStudent(response.data.student);
      loadStudents();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to unblock student.");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    loadStudents();
    const interval = setInterval(loadStudents, 15000); // refresh student list every 15s
    return () => clearInterval(interval);
  }, []);

  async function loadMessages(silent = false) {
    if (!selectedStudent?._id) return;
    if (!silent) setLoadingMessages(true);

    try {
      const response = await axios.get(
        `${API_BASE}/admin/${selectedStudent._id}/messages`,
        getAuthHeaders()
      );
      setMessages(response.data.messages || []);
    } catch (err) {
      if (!silent) {
        setError(
          err.response?.data?.message || "Unable to load this conversation."
        );
      }
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }

  useEffect(() => {
    if (!selectedStudent?._id) {
      setMessages([]);
      return;
    }

    loadMessages(false);
    const interval = setInterval(() => loadMessages(true), 4000); // Live poll conversation every 4s
    return () => clearInterval(interval);
  }, [selectedStudent?._id]);

  async function sendMessage(event) {
    if (event) event.preventDefault();

    const messageText = text.trim();
    if (!selectedStudent || !messageText || sending) return;

    setSending(true);
    setError("");
    setNotice("");

    try {
      const response = await axios.post(
        `${API_BASE}/admin/${selectedStudent._id}/messages`,
        { text: messageText },
        getAuthHeaders()
      );

      setMessages((previous) => [...previous, response.data.message]);
      setText("");
      setNotice("Message sent.");
      setTimeout(() => setNotice(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send the message.");
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(messageId) {
    if (!window.confirm("Delete this message?")) return;
    try {
      await axios.delete(`${API_BASE}/admin/messages/${messageId}`, getAuthHeaders());
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
      setNotice("Message deleted successfully.");
      setTimeout(() => setNotice(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete message.");
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="private-chat-page">
      <div className="private-chat-heading">
        <div>
          <h1>Private Messages</h1>
          <p>Chat privately with verified SRM students.</p>
        </div>
        <span className="private-chat-badge">PRIVATE</span>
      </div>

      {error && <div className="private-chat-error">{error}</div>}
      {notice && <div className="private-chat-notice">{notice}</div>}

      <div className="private-chat-layout">
        <aside className="private-chat-students">
          <h2>Verified Students</h2>

          {loadingStudents ? (
            <p className="private-chat-muted">Loading students...</p>
          ) : students.length === 0 ? (
            <p className="private-chat-muted">
              No verified students yet. A student must register and verify their
              @srmist.edu.in email first.
            </p>
          ) : (
            <div className="private-chat-student-list">
              {students.map((student) => (
                <button
                  key={student._id}
                  type="button"
                  className={`private-chat-student ${
                    selectedStudent?._id === student._id ? "selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedStudent(student);
                    setNotice("");
                    setError("");
                  }}
                >
                  <span className="private-chat-avatar">
                    {(student.username || student.email || "S")
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                  <span className="private-chat-student-info">
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <strong>{student.username || "SRM Student"}</strong>
                      {student.unreadCount > 0 && (
                        <span style={{
                          background: "#ef4444",
                          color: "#ffffff",
                          fontSize: "11px",
                          fontWeight: "800",
                          padding: "2px 7px",
                          borderRadius: "999px",
                          boxShadow: "0 0 10px rgba(239, 68, 68, 0.5)",
                          letterSpacing: "0.5px"
                        }}>
                          {student.unreadCount} NEW
                        </span>
                      )}
                    </span>
                    <small>
                      {student.latestMessage?.text
                        ? (student.latestMessage.text.length > 28
                            ? student.latestMessage.text.slice(0, 28) + "..."
                            : student.latestMessage.text)
                        : student.email}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="private-chat-conversation">
          {!selectedStudent ? (
            <div className="private-chat-empty">
              <div className="private-chat-empty-icon">✉</div>
              <h2>Select a student</h2>
              <p>Choose a verified student to open your private conversation.</p>
            </div>
          ) : (
            <>
              <div className="private-chat-conversation-header">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h2>{selectedStudent.username || "SRM Student"}</h2>
                    {selectedStudent.status === "blocked" || (selectedStudent.blockedUntil && new Date() < new Date(selectedStudent.blockedUntil)) ? (
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: "800",
                        background: "rgba(239, 68, 68, 0.2)",
                        color: "#ef4444",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                      }}>
                        🚫 RESTRICTED ({selectedStudent.blockScope || "all_chat"})
                      </span>
                    ) : (
                      <span className="private-chat-verified">Verified</span>
                    )}
                  </div>
                  <p>{selectedStudent.email}</p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {selectedStudent.status === "blocked" || (selectedStudent.blockedUntil && new Date() < new Date(selectedStudent.blockedUntil)) ? (
                    <button
                      type="button"
                      onClick={handleUnblock}
                      disabled={actionLoading}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        border: "1px solid rgba(16, 185, 129, 0.4)",
                        background: "rgba(16, 185, 129, 0.15)",
                        color: "#34d399",
                        fontWeight: "750",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      ✓ Unblock Student
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowBlockModal(true)}
                      disabled={actionLoading}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        background: "rgba(239, 68, 68, 0.12)",
                        color: "#f87171",
                        fontWeight: "750",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      🚫 Restrict User
                    </button>
                  )}
                </div>
              </div>

              <div className="private-chat-messages" aria-live="polite">
                {loadingMessages ? (
                  <p className="private-chat-muted">Loading conversation...</p>
                ) : messages.length === 0 ? (
                  <div className="private-chat-empty">
                    <h3>No messages yet</h3>
                    <p>Send the first private message to this student.</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isAdmin = message.senderId === "admin";

                    return (
                      <div
                        key={message._id}
                        className={`private-chat-message ${
                          isAdmin ? "sent" : "received"
                        }`}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <span className="private-chat-message-sender">
                            {isAdmin ? "You" : message.senderName}
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteMessage(message._id)}
                            title="Delete message"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "rgba(248, 113, 113, 0.7)",
                              fontSize: "12px",
                              cursor: "pointer",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(248, 113, 113, 0.7)")}
                          >
                            🗑 Delete
                          </button>
                        </div>
                        <p>{message.text}</p>
                        <time>
                          {message.createdAt
                            ? new Date(message.createdAt).toLocaleString()
                            : ""}
                        </time>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="private-chat-compose" onSubmit={sendMessage}>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Write a private message... (Press Enter to send, Shift+Enter for new line)"
                  maxLength={2000}
                  rows={2}
                  required
                />
                <div className="private-chat-compose-footer">
                  <small>{text.length}/2000</small>
                  <button
                    type="submit"
                    disabled={!text.trim() || sending}
                  >
                    {sending ? "Sending..." : "Send Message"}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>

      {showBlockModal && selectedStudent && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(3, 7, 18, 0.75)",
          backdropFilter: "blur(6px)",
          zIndex: 9999,
          display: "grid",
          placeItems: "center",
          padding: "20px"
        }}>
          <div style={{
            background: "#0f172a",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: "20px",
            padding: "28px",
            width: "min(480px, 100%)",
            boxShadow: "0 25px 80px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.15)",
          }}>
            <h3 style={{ margin: "0 0 8px", color: "#f87171", fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🚫</span>
              <span>Restrict Student Access</span>
            </h3>
            <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: "13px" }}>
              Configure moderation action for <strong>{selectedStudent.email}</strong>
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", fontWeight: "700", marginBottom: "6px" }}>
                Restriction Duration
              </label>
              <select
                value={blockDuration}
                onChange={(e) => setBlockDuration(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "#1e293b",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#f8fafc",
                  fontSize: "13px"
                }}
              >
                <option value="10m">Temporary block — 10 minutes</option>
                <option value="24h">Temporary block — 1 day (24 hours)</option>
                <option value="permanent">Permanent block (Requires admin review)</option>
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", fontWeight: "700", marginBottom: "6px" }}>
                Where should the block apply?
              </label>
              <select
                value={blockScope}
                onChange={(e) => setBlockScope(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "#1e293b",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#f8fafc",
                  fontSize: "13px"
                }}
              >
                <option value="all_chat">Both Community Chat & Private Messages</option>
                <option value="community">Community Chat only</option>
                <option value="private">Private Messages only</option>
                <option value="website">Entire Website (Account suspension)</option>
              </select>
            </div>

            <div style={{ marginBottom: "22px" }}>
              <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", fontWeight: "700", marginBottom: "6px" }}>
                Reason for Moderation Action
              </label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. Inappropriate language, spamming, harassment"
                maxLength={200}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "#1e293b",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#f8fafc",
                  fontSize: "13px",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  background: "transparent",
                  color: "#94a3b8",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyBlock}
                disabled={actionLoading}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#ef4444",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "800",
                  cursor: "pointer",
                  boxShadow: "0 0 15px rgba(239, 68, 68, 0.4)"
                }}
              >
                {actionLoading ? "Applying..." : "Confirm Restriction"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
