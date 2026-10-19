import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const token = localStorage.getItem("srm-admin-token");
      const res = await axios.get(`${API_BASE}/api/admin/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        setData(res.data.analytics);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
        <div style={{ fontSize: "28px", marginBottom: "12px" }}>📊</div>
        Loading live analytics and performance metrics...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
        Unable to load analytics. Please check your backend connection.
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", color: "#f8fafc", maxWidth: "1300px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "28px", fontWeight: "800", letterSpacing: "-0.5px" }}>
            Platform Analytics & Insights
          </h1>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
            Real-time telemetry, resource distribution, and student engagement metrics.
          </p>
        </div>

        <button
          onClick={loadAnalytics}
          style={{
            padding: "9px 16px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "10px",
            color: "#f8fafc",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          🔄 Refresh Metrics
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(59, 130, 246, 0.25)", borderRadius: "16px", padding: "20px", position: "relative", overflow: "hidden" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            Total Study Resources
          </div>
          <div style={{ fontSize: "32px", fontWeight: "800", color: "#ffffff", letterSpacing: "-1px" }}>
            {data.totalResources}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
            Notes, PYQs, PPTs uploaded
          </div>
        </div>

        <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "16px", padding: "20px", position: "relative", overflow: "hidden" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: "#6ee7b7", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            Live Active Students
          </div>
          <div style={{ fontSize: "32px", fontWeight: "800", color: "#ffffff", letterSpacing: "-1px", display: "flex", alignItems: "center", gap: "10px" }}>
            {data.activeNow}
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 12px #10b981" }}></span>
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
            Online within last 90 seconds
          </div>
        </div>

        <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(168, 85, 247, 0.25)", borderRadius: "16px", padding: "20px", position: "relative", overflow: "hidden" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: "#d8b4fe", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            Registered Students
          </div>
          <div style={{ fontSize: "32px", fontWeight: "800", color: "#ffffff", letterSpacing: "-1px" }}>
            {data.totalStudents}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
            Accounts in student database
          </div>
        </div>

        <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(245, 158, 11, 0.25)", borderRadius: "16px", padding: "20px", position: "relative", overflow: "hidden" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: "#fcd34d", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            Total User Sessions
          </div>
          <div style={{ fontSize: "32px", fontWeight: "800", color: "#ffffff", letterSpacing: "-1px" }}>
            {data.totalSessions}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
            Unique student visits tracked
          </div>
        </div>
      </div>

      {/* Two Column Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "20px", marginBottom: "28px" }}>
        {/* Semester Breakdown */}
        <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "16px", padding: "24px" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "17px", fontWeight: "700" }}>
            📚 Resources by Semester
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {data.semBreakdown.map((item) => {
              const maxCount = Math.max(...data.semBreakdown.map((s) => s.count), 1);
              const pct = Math.round((item.count / maxCount) * 100);
              return (
                <div key={item.semester}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "5px" }}>
                    <span style={{ color: "#e2e8f0", fontWeight: "600" }}>Semester {item.semester}</span>
                    <span style={{ color: "#94a3b8" }}>{item.count} notes</span>
                  </div>
                  <div style={{ height: "8px", background: "rgba(255, 255, 255, 0.06)", borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #3b82f6, #06b6d4)", borderRadius: "999px" }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Subjects */}
        <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "16px", padding: "24px" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "17px", fontWeight: "700" }}>
            🔥 Most Populated Subjects
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {data.topSubjects.map((item, idx) => (
              <div key={item.subject} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "22px", height: "22px", borderRadius: "6px", background: "rgba(255, 255, 255, 0.08)", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: "700", color: "#94a3b8" }}>
                    #{idx + 1}
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#f8fafc" }}>
                    {item.subject}
                  </span>
                </div>
                <span style={{ fontSize: "12px", color: "#38bdf8", fontWeight: "700", background: "rgba(56, 189, 248, 0.1)", padding: "3px 8px", borderRadius: "6px" }}>
                  {item.count} items
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Student Activity Stream */}
      <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "16px", padding: "24px" }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "17px", fontWeight: "700" }}>
          ⚡ Recent Student Live Activity Stream
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", color: "#94a3b8" }}>
                <th style={{ padding: "10px" }}>Student</th>
                <th style={{ padding: "10px" }}>Active Page</th>
                <th style={{ padding: "10px" }}>Subject</th>
                <th style={{ padding: "10px" }}>Last Ping</th>
              </tr>
            </thead>
            <tbody>
              {data.recentActivity.map((act, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                  <td style={{ padding: "12px 10px", fontWeight: "600", color: "#f8fafc" }}>
                    {act.name} <small style={{ color: "#64748b", fontWeight: "normal" }}>({act.email})</small>
                  </td>
                  <td style={{ padding: "12px 10px", color: "#93c5fd" }}>
                    {act.page}
                  </td>
                  <td style={{ padding: "12px 10px", color: "#cbd5e1" }}>
                    {act.subject || "Browsing"}
                  </td>
                  <td style={{ padding: "12px 10px", color: "#94a3b8", fontSize: "12px" }}>
                    {new Date(act.time).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

