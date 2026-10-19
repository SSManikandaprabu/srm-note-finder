import { useEffect, useRef } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function UserTracker({ page = "Home", semester = "", selectedSubject = "", email = "" }) {
  const sessionIdRef = useRef(null);

  useEffect(() => {
    // Generate or retrieve persistent sessionId
    let sessionId = sessionStorage.getItem("srm_session_id");
    if (!sessionId) {
      sessionId = "sess_" + Math.random().toString(36).substring(2, 12) + "_" + Date.now();
      sessionStorage.setItem("srm_session_id", sessionId);
    }
    sessionIdRef.current = sessionId;

    let userId = localStorage.getItem("srm_user_id");
    if (!userId) {
      userId = "user_" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("srm_user_id", userId);
    }

    const studentEmail = email || localStorage.getItem("srm-student-email") || "";
    const studentName = studentEmail ? studentEmail.split("@")[0] : "Student";

    // 1. Start live session
    axios.post(`${API_BASE}/api/sessions/start`, {
      sessionId,
      userId,
      name: studentName,
      email: studentEmail,
      currentPage: page,
      semester: semester ? String(semester) : "",
      subject: selectedSubject || "",
      activity: selectedSubject ? `Viewing ${selectedSubject}` : `Browsing ${page}`,
    }).catch(() => {});

    // 2. Regular heartbeat every 45 seconds to keep "Live Online" active while staying well within free-tier MongoDB limits
    const interval = setInterval(() => {
      axios.post(`${API_BASE}/api/sessions/heartbeat`, {
        sessionId,
        currentPage: page,
        semester: semester ? String(semester) : "",
        subject: selectedSubject || "",
        activity: selectedSubject ? `Viewing ${selectedSubject}` : `Browsing ${page}`,
      }).catch(() => {});
    }, 45000);

    return () => clearInterval(interval);
  }, [page, semester, selectedSubject, email]);

  return null;
}

export default UserTracker;