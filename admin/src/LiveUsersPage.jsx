import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function LiveUsersPage() {
  const [liveUsers, setLiveUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("live");
  const [loading, setLoading] = useState(true);

  // Modern Block Modal State
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedStudentForBlock, setSelectedStudentForBlock] = useState(null);
  const [blockDuration, setBlockDuration] = useState("10m");
  const [blockScope, setBlockScope] = useState("all_chat");
  const [blockReason, setBlockReason] = useState("");
  const [blockingInProgress, setBlockingInProgress] = useState(false);

  const token = localStorage.getItem("srm-admin-token");
  const authHeaders = {
    headers: { Authorization: `Bearer ${token}` },
  };

  async function loadData() {
    try {
      const [liveRes, allRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/live-users`, authHeaders).catch(() => ({ data: { users: [] } })),
        axios.get(`${API_BASE}/api/admin/users`, authHeaders).catch(() => ({ data: { users: [] } })),
      ]);
      setLiveUsers(liveRes.data.users || []);
      setAllUsers(allRes.data.users || []);
    } catch (err) {
      console.error("Failed to load user data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Live poll every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: "24px", color: "#f8fafc" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "28px", fontWeight: "800", letterSpacing: "-0.5px" }}>
            User Management & Live Activity
          </h1>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
            Real-time tracking of active student sessions and browsing activity.
          </p>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: "flex", gap: "8px", background: "rgba(15, 23, 42, 0.6)", padding: "4px", borderRadius: "12px", border: "1px solid rgba(148, 163, 184, 0.15)" }}>
          <button
            type="button"
            onClick={() => setActiveTab("live")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: 0,
              cursor: "pointer",
              fontWeight: "700",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: activeTab === "live" ? "linear-gradient(135deg, #06b6d4, #3b82f6)" : "transparent",
              color: activeTab === "live" ? "#fff" : "#94a3b8",
            }}
          >
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 8px #22c55e" }}></span>
            Live Online ({liveUsers.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("all")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: 0,
              cursor: "pointer",
              fontWeight: "700",
              fontSize: "13px",
              background: activeTab === "all" ? "linear-gradient(135deg, #06b6d4, #3b82f6)" : "transparent",
              color: activeTab === "all" ? "#fff" : "#94a3b8",
            }}
          >
            All Registered ({allUsers.length})
          </button>
        </div>
      </div>

      {/* Grid of Users */}
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Loading active sessions...</div>
      ) : activeTab === "live" ? (
        liveUsers.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(15, 23, 42, 0.4)", borderRadius: "16px", border: "1px solid rgba(148, 163, 184, 0.1)" }}>
            <span style={{ fontSize: "36px" }}>👥</span>
            <h3 style={{ margin: "12px 0 6px 0", color: "#e2e8f0" }}>No users online right now</h3>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
              As soon as a student opens SRM Note Finder, they will appear here in real time.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {liveUsers.map((user) => (
              <div
                key={user.sessionId || user._id}
                style={{
                  background: "rgba(15, 23, 42, 0.75)",
                  border: "1px solid rgba(34, 211, 238, 0.25)",
                  borderRadius: "16px",
                  padding: "18px",
                  backdropFilter: "blur(12px)",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <strong style={{ fontSize: "15px", color: "#f8fafc", display: "block" }}>
                      {user.name || "Student"}
                    </strong>
                    <small style={{ color: "#94a3b8", fontSize: "12px" }}>
                      {user.email || "Guest Session"}
                    </small>
                  </div>
                  <span
                    style={{
                      background: "rgba(34, 197, 94, 0.15)",
                      border: "1px solid rgba(34, 197, 94, 0.3)",
                      color: "#4ade80",
                      fontSize: "11px",
                      fontWeight: "800",
                      padding: "4px 8px",
                      borderRadius: "999px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80" }}></span>
                    ONLINE
                  </span>
                </div>

                <div style={{ fontSize: "13px", color: "#cbd5e1", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div>
                    <span style={{ color: "#64748b" }}>Current Page: </span>
                    <span style={{ color: "#38bdf8", fontWeight: "600" }}>{user.currentPage || "Home"}</span>
                  </div>
                  {user.subject && (
                    <div>
                      <span style={{ color: "#64748b" }}>Subject: </span>
                      <span>{user.subject}</span>
                    </div>
                  )}
                  {user.semester && (
                    <div>
                      <span style={{ color: "#64748b" }}>Semester: </span>
                      <span>Semester {user.semester}</span>
                    </div>
                  )}
                  <div>
                    <span style={{ color: "#64748b" }}>Activity: </span>
                    <span>{user.activity || "Browsing"}</span>
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "11px", color: "#94a3b8" }}>
                    Last active: {user.lastActivity ? new Date(user.lastActivity).toLocaleTimeString() : "Just now"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* All Users Table */
        <div style={{ background: "rgba(15, 23, 42, 0.65)", borderRadius: "16px", border: "1px solid rgba(148, 163, 184, 0.15)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.15)", background: "rgba(30, 41, 59, 0.5)", color: "#94a3b8" }}>
                <th style={{ padding: "14px 18px" }}>Student</th>
                <th style={{ padding: "14px 18px" }}>Email</th>
                <th style={{ padding: "14px 18px" }}>Verified</th>
                <th style={{ padding: "14px 18px" }}>Account & Chat Status</th>
                <th style={{ padding: "14px 18px" }}>Moderation Action</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>
                    No recorded students yet.
                  </td>
                </tr>
              ) : (
                allUsers.map((u) => {
                  const isBlocked = u.status === "blocked" || (u.blockedUntil && new Date() < new Date(u.blockedUntil));
                  return (
                    <tr key={u.userId || u._id} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                      <td style={{ padding: "14px 18px", fontWeight: "600", color: "#f1f5f9" }}>{u.name || "Student"}</td>
                      <td style={{ padding: "14px 18px", color: "#94a3b8" }}>{u.email || "—"}</td>
                      <td style={{ padding: "14px 18px" }}>
                        <span style={{
                          padding: "2px 7px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: "700",
                          background: u.emailVerified ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: u.emailVerified ? "#34d399" : "#fbbf24",
                        }}>
                          {u.emailVerified ? "✓ Verified" : "Pending"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        {isBlocked ? (
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: "700",
                              background: "rgba(239, 68, 68, 0.15)",
                              color: "#f87171",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                            }}
                          >
                            🚫 Restricted ({u.blockScope || "all_chat"})
                          </span>
                        ) : (
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: "700",
                              background: "rgba(34, 197, 94, 0.15)",
                              color: "#4ade80",
                            }}
                          >
                            ● Active (No restrictions)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        {isBlocked ? (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Unblock ${u.email}?`)) return;
                              try {
                                await axios.post(`${API_BASE}/api/private-chat/admin/${u._id || u.userId}/unblock`, {}, authHeaders);
                                loadData();
                              } catch (e) {
                                alert("Failed to unblock: " + (e.response?.data?.message || e.message));
                              }
                            }}
                            style={{
                              padding: "5px 12px",
                              borderRadius: "8px",
                              border: "1px solid rgba(16, 185, 129, 0.4)",
                              background: "rgba(16, 185, 129, 0.15)",
                              color: "#34d399",
                              fontSize: "12px",
                              fontWeight: "700",
                              cursor: "pointer",
                            }}
                          >
                            ✓ Unblock
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudentForBlock(u);
                              setBlockDuration("10m");
                              setBlockScope("all_chat");
                              setBlockReason("");
                              setShowBlockModal(true);
                            }}
                            style={{
                              padding: "5px 12px",
                              borderRadius: "8px",
                              border: "1px solid rgba(239, 68, 68, 0.4)",
                              background: "rgba(239, 68, 68, 0.12)",
                              color: "#f87171",
                              fontSize: "12px",
                              fontWeight: "700",
                              cursor: "pointer",
                            }}
                          >
                            🚫 Block User
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modern Block / Restriction Modal */}
      {showBlockModal && selectedStudentForBlock && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !blockingInProgress) {
              setShowBlockModal(false);
              setSelectedStudentForBlock(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(3, 7, 18, 0.8)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f172a",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "20px",
              padding: "28px",
              width: "min(480px, 100%)",
              boxShadow: "0 25px 80px rgba(0, 0, 0, 0.75), 0 0 30px rgba(239, 68, 68, 0.15)",
              color: "#f8fafc",
            }}
          >
            <h3 style={{ margin: "0 0 8px", color: "#f87171", fontSize: "19px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🚫</span>
              <span>Restrict Student Access</span>
            </h3>
            <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: "13px" }}>
              Configure moderation action for <strong>{selectedStudentForBlock.email || selectedStudentForBlock.name || "Student"}</strong>
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
                  fontSize: "13px",
                  outline: "none",
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
                  fontSize: "13px",
                  outline: "none",
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
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setShowBlockModal(false);
                  setSelectedStudentForBlock(null);
                }}
                disabled={blockingInProgress}
                style={{
                  padding: "9px 18px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#94a3b8",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={blockingInProgress}
                onClick={async () => {
                  setBlockingInProgress(true);
                  try {
                    await axios.post(
                      `${API_BASE}/api/private-chat/admin/${selectedStudentForBlock._id || selectedStudentForBlock.userId}/block`,
                      {
                        duration: blockDuration,
                        scope: blockScope,
                        reason: blockReason || "Violation of community guidelines",
                      },
                      authHeaders
                    );
                    setShowBlockModal(false);
                    setSelectedStudentForBlock(null);
                    await loadData();
                  } catch (err) {
                    alert("Failed to block user: " + (err.response?.data?.message || err.message));
                  } finally {
                    setBlockingInProgress(false);
                  }
                }}
                style={{
                  padding: "9px 20px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  border: 0,
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: blockingInProgress ? "wait" : "pointer",
                  boxShadow: "0 4px 14px rgba(239, 68, 68, 0.4)",
                  opacity: blockingInProgress ? 0.7 : 1,
                }}
              >
                {blockingInProgress ? "Applying..." : "Confirm & Apply Block"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

