import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import UserTracker from "./UserTracker";
import CommunityChat from "./CommunityChat";
import StudentAuth from "./StudentAuth";
import StudentNotifications from "./StudentNotifications";
import StudentPrivateMessages from "./StudentPrivateMessages";
import "./StudentStudyExperience.css";

/* =========================================================
   API
========================================================= */

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  "http://localhost:5000";

/* =========================================================
   SUBJECTS
========================================================= */

const subjects = {
  1: [
    "Calculus And Linear Algebra",
    "Chemistry",
    "Philosophy Of Engineering",
    "Introduction To Computational Biology",
    "Programming For Problem Solving",
    "Fundamental Of Economics (FOE)",
    "Biomedical Sensors",
    "Foreign Languages",
    "Physical And Analytical Chemistry",
    "Biology",
  ],

  2: [
    "Advanced Calculus And Complex Analysis",
    "Electrical And Electronics Engineering",
    "Object Oriented Design And Programming",
    "Communicative English",
  ],

  3: [
    "Data Structures And Algorithm",
    "Computer Organization And Architecture",
    "Operating Systems",
    "Advanced Programming Practice",
  ],

  4: [
    "Design And Analysis Of Algorithms",
    "Database Management Systems",
    "Artificial Intelligence",
    "Digital Image Processing",
  ],

  5: [
    "Discrete Mathematics",
    "Full Stack Web Development",
    "Computer Networks",
    "Machine Learning",
    "Formal Language And Automata",
    "Short Range Wireless Communication",
  ],

  6: [
    "Data Science",
    "Software Engineering & Project Management",
    "Compiler Design",
  ],

  7: [
    "Behavioral Psychology",
    "Professional Elective 5",
    "Professional Elective 6",
  ],

  8: [
    "Major Project",
    "Internship",
  ],
};

/* =========================================================
   HELPERS
========================================================= */

function normalizeLinks(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  return String(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
}

function getTotalResources(resources) {
  return resources.reduce((total, item) => {
    let count = 0;

    [1, 2, 3, 4, 5].forEach((unit) => {
      count += normalizeLinks(item[`unit${unit}`]).length;
    });

    count += normalizeLinks(item.pyq).length;

    return total + count;
  }, 0);
}

/* =========================================================
   RESOURCE ROW
========================================================= */

function ResourceRow({ item, onEdit, onDelete }) {
  const unitCount = [1, 2, 3, 4, 5].filter(
    (unit) =>
      normalizeLinks(item[`unit${unit}`]).length > 0
  ).length;

  const pyqCount = normalizeLinks(item.pyq).length;

  return (
    <div className="resource-row">
      <div className="resource-subject">
        <strong>{item.subject}</strong>

        <span>{item._id || item.id || ""}</span>
      </div>

      <div>
        <span className="semester-badge">
          Sem {item.semester}
        </span>
      </div>

      <div>
        <span className="count-badge">
          {unitCount}/5
        </span>
      </div>

      <div>
        <span className="count-badge">
          {pyqCount}
        </span>
      </div>

      <div className="row-actions">
        <button
          className="edit-button"
          onClick={() => onEdit(item)}
        >
          Edit
        </button>

        <button
          className="delete-button"
          onClick={() => onDelete(item)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   ADMIN INPUT
========================================================= */

function AdminInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  options = [],
  textarea = false,
}) {
  return (
    <div className="admin-field">
      <label>{label}</label>

      {type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      ) : textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={5}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

/* =========================================================
   DELETE MODAL
========================================================= */

function DeleteModal({
  resource,
  onCancel,
  onConfirm,
}) {
  return (
    <div className="modal-overlay">
      <div className="delete-modal">
        <div className="delete-icon">!</div>

        <h2>Delete Resource?</h2>

        <p>
          Are you sure you want to delete{" "}
          <strong>{resource.subject}</strong>?
        </p>

        <div className="modal-actions">
          <button
            className="ghost-button"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            className="danger-button"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SEMESTER CARD
========================================================= */

function SemesterCard({
  semester,
  count,
  onClick,
}) {
  return (
    <button
      className="semester-card"
      onClick={onClick}
    >
      <div className="semester-number">
        {String(semester).padStart(2, "0")}
      </div>

      <div className="semester-card-content">
        <span>SEMESTER</span>

        <h3>Semester {semester}</h3>

        <p>{count} subjects</p>
      </div>

      <div className="arrow-circle">→</div>
    </button>
  );
}

/* =========================================================
   SUBJECT CARD
========================================================= */

function SubjectCard({
  subject,
  semester,
  index,
  onClick,
}) {
  return (
    <button
      className="subject-card"
      onClick={onClick}
    >
      <div className="subject-index">
        {String(index + 1).padStart(2, "0")}
      </div>

      <div className="subject-card-content">
        {semester && (
          <span className="subject-sem">
            SEM {semester}
          </span>
        )}

        <h3>{subject}</h3>

        <span className="subject-open">
          Open resources →
        </span>
      </div>
    </button>
  );
}

/* =========================================================
   RESOURCE CARD
========================================================= */

function ResourceCard({
  unit,
  links,
  subject,
  isBookmarked,
  onToggleBookmark
}) {
  return (
    <div className="resource-card">
      <div className="resource-card-top" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="resource-icon">📖</div>
          <div>
            <span>STUDY MATERIAL</span>
            <h3>Unit {unit}</h3>
          </div>
        </div>

        {onToggleBookmark && (
          <button
            className={`unit-bookmark-toggle ${isBookmarked ? "bookmarked" : ""}`}
            onClick={onToggleBookmark}
            title={isBookmarked ? "Remove Bookmark" : "Bookmark this Unit"}
          >
            {isBookmarked ? "★" : "☆"}
          </button>
        )}
      </div>

      {links.length ? (
        <div className="link-list">
          {links.map((link, index) => (
            <a
              key={`${link}-${index}`}
              href={link}
              target="_blank"
              rel="noreferrer"
              className="drive-link"
            >
              <span>🔗</span>
              Open Resource
              {links.length > 1 ? ` ${index + 1}` : ""}
              <span>↗</span>
            </a>
          ))}
        </div>
      ) : (
        <div className="no-link">No resource added</div>
      )}
    </div>
  );
}

/* =========================================================
   SMART PYQ (PREVIOUS YEAR QUESTIONS) CARD & FILTER
========================================================= */

function PyqCard({ links, subject }) {
  const [selectedExamType, setSelectedExamType] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");

  // Parse and tag each link based on title/url heuristics
  const parsedLinks = useMemo(() => {
    return links.map((link, idx) => {
      const lower = link.toLowerCase();
      
      // Determine exam type
      let examType = "University Sem Exam";
      if (lower.includes("ct1") || lower.includes("ct-1") || lower.includes("cycle test 1") || lower.includes("cycletest1")) {
        examType = "Cycle Test 1";
      } else if (lower.includes("ct2") || lower.includes("ct-2") || lower.includes("cycle test 2") || lower.includes("cycletest2")) {
        examType = "Cycle Test 2";
      } else if (lower.includes("model") || lower.includes("pre-sem")) {
        examType = "Model Exam";
      }

      // Determine year
      let year = "Recent";
      const yearMatch = lower.match(/(202[0-6])/);
      if (yearMatch) {
        year = yearMatch[1];
      } else {
        // Distribute year tags intelligently if not embedded in link
        const fallbackYears = ["2024", "2023", "2022", "2021"];
        year = fallbackYears[idx % fallbackYears.length];
      }

      return {
        url: link,
        index: idx + 1,
        examType,
        year,
      };
    });
  }, [links]);

  // Filtered links
  const filteredLinks = useMemo(() => {
    return parsedLinks.filter((item) => {
      const matchExam = selectedExamType === "all" || item.examType === selectedExamType;
      const matchYear = selectedYear === "all" || item.year === selectedYear;
      return matchExam && matchYear;
    });
  }, [parsedLinks, selectedExamType, selectedYear]);

  return (
    <div className="resource-card pyq-card">
      <div className="resource-card-top" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="resource-icon">📝</div>
          <div>
            <span>EXAM PREPARATION</span>
            <h3>Previous Year Questions (PYQs)</h3>
          </div>
        </div>
      </div>

      {links.length > 0 && (
        <div className="pyq-filter-container">
          <div className="pyq-filter-group">
            <span className="pyq-filter-label">Exam:</span>
            {["all", "Cycle Test 1", "Cycle Test 2", "University Sem Exam"].map((type) => (
              <button
                key={type}
                className={`pyq-filter-btn ${selectedExamType === type ? "active" : ""}`}
                onClick={() => setSelectedExamType(type)}
              >
                {type === "all" ? "All Exams" : type}
              </button>
            ))}
          </div>

          <div className="pyq-filter-group">
            <span className="pyq-filter-label">Year:</span>
            {["all", "2024", "2023", "2022", "2021"].map((yr) => (
              <button
                key={yr}
                className={`pyq-filter-btn ${selectedYear === yr ? "active" : ""}`}
                onClick={() => setSelectedYear(yr)}
              >
                {yr === "all" ? "All Years" : yr}
              </button>
            ))}
          </div>
        </div>
      )}

      {links.length ? (
        filteredLinks.length ? (
          <div className="link-list">
            {filteredLinks.map((item) => (
              <a
                key={`${item.url}-${item.index}`}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="drive-link"
              >
                <span>📄</span>
                PYQ Paper {item.index}
                <span className="pyq-tag">{item.examType}</span>
                <span className="pyq-tag" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", borderColor: "rgba(168, 85, 247, 0.3)" }}>
                  {item.year}
                </span>
                <span style={{ marginLeft: "auto" }}>↗</span>
              </a>
            ))}
          </div>
        ) : (
          <div className="pyq-empty-results">
            No question papers found matching <strong>{selectedExamType}</strong> ({selectedYear}).
            <br />
            <button
              className="pyq-filter-btn"
              style={{ marginTop: "8px" }}
              onClick={() => { setSelectedExamType("all"); setSelectedYear("all"); }}
            >
              Reset Filters
            </button>
          </div>
        )
      ) : (
        <div className="no-link">No PYQ added</div>
      )}
    </div>
  );
}

/* =========================================================
   SECTION HEADING
========================================================= */

function SectionHeading({
  eyebrow,
  title,
  description,
}) {
  return (
    <div className="section-heading">
      <div className="eyebrow">{eyebrow}</div>

      <h1>{title}</h1>

      <p>{description}</p>
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  icon,
  value,
  label,
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>

      <div>
        <strong>{value}</strong>

        <span>{label}</span>
      </div>
    </div>
  );
}

/* =========================================================
   SCORE BOX
========================================================= */

function ScoreBox({ label, value }) {
  return (
    <div className="score-box">
      <span>{label}</span>

      <strong>{value}</strong>
    </div>
  );
}

/* =========================================================
   NAV BUTTON
========================================================= */

function navButton(active) {
  return active
    ? "nav-button active"
    : "nav-button";
}

/* =========================================================
   MAIN APP
========================================================= */

export default function App() {
  const [page, setPage] = useState("home");

  const [selectedSemester, setSelectedSemester] =
    useState(null);

  const [selectedSubject, setSelectedSubject] =
    useState(null);

  const [resources, setResources] = useState([]);

  const [loadingResources, setLoadingResources] =
    useState(false);

  const [resourceError, setResourceError] =
    useState("");

  const [serverStatus, setServerStatus] =
    useState("checking");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [customizerOpen, setCustomizerOpen] =
    useState(false);

  const [theme, setTheme] =
    useState("aurora-cyan");

  const [background, setBackground] =
    useState("aurora");

  const [glowIntensity, setGlowIntensity] =
    useState("medium");

  const [studentToken, setStudentToken] = useState(
    () => localStorage.getItem("srm-student-token") || ""
  );

  const [studentEmail, setStudentEmail] = useState(
    () => localStorage.getItem("srm-student-email") || ""
  );

  const [showStudentAuth, setShowStudentAuth] = useState(false);
  const [showPrivateMessages, setShowPrivateMessages] = useState(false);

  // Student Study Experience State (Bookmarks)
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("srm-student-bookmarks") || "[]");
    } catch {
      return [];
    }
  });

  const [adminLoggedIn, setAdminLoggedIn] =
    useState(
      Boolean(
        localStorage.getItem(
          "srm_admin_token"
        )
      )
    );

  const [adminUsername, setAdminUsername] =
    useState(
      localStorage.getItem(
        "srm_admin_username"
      ) || ""
    );

  const [adminSection, setAdminSection] =
    useState("dashboard");

  const [adminResources, setAdminResources] =
    useState([]);

  const [adminLoading, setAdminLoading] =
    useState(false);

  const [adminNotice, setAdminNotice] =
    useState(null);

  const [editingResource, setEditingResource] =
    useState(null);

  const [deleteResource, setDeleteResource] =
    useState(null);

  const [adminForm, setAdminForm] =
    useState({
      semester: "1",
      subject: "",
      unit1: "",
      unit2: "",
      unit3: "",
      unit4: "",
      unit5: "",
      pyq: "",
    });

  /* =======================================================
     CHECK BACKEND & SYNC SETTINGS
  ======================================================= */

  useEffect(() => {
    async function checkServer() {
      try {
        await axios.get(`${API_BASE}/`);

        setServerStatus("online");
      } catch {
        setServerStatus("offline");
      }
    }

    async function syncSettings() {
      try {
        const res = await axios.get(`${API_BASE}/api/settings`);
        if (res.data?.settings) {
          const s = res.data.settings;
          if (s.theme) {
            setTheme(s.theme);
          }
          if (s.backgroundStyle) {
            setBackground(s.backgroundStyle);
          }
          if (s.glowIntensity) {
            setGlowIntensity(s.glowIntensity);
          }
        }
      } catch (err) {
        console.error("Failed to load settings in student app:", err);
      }
    }

    checkServer();
    syncSettings();

    const interval = setInterval(
      checkServer,
      15000
    );

    return () => clearInterval(interval);
  }, []);

  /* =======================================================
     BOOKMARKS SYSTEM
  ======================================================= */

  // Sync bookmarks from backend if student is signed in
  useEffect(() => {
    async function fetchServerBookmarks() {
      if (!studentToken) return;
      try {
        const res = await axios.get(`${API_BASE}/api/student-auth/bookmarks`, {
          headers: { Authorization: `Bearer ${studentToken}` },
        });
        if (res.data?.success && Array.isArray(res.data.bookmarks)) {
          setBookmarks(res.data.bookmarks);
          localStorage.setItem("srm-student-bookmarks", JSON.stringify(res.data.bookmarks));
        }
      } catch (err) {
        console.warn("Could not sync remote bookmarks, using local state:", err.message);
      }
    }
    fetchServerBookmarks();
  }, [studentToken]);

  async function handleToggleBookmark(item) {
    // Optimistic local update
    const isSubjectOnly = !item.unit;
    const exists = bookmarks.some((b) => {
      if (isSubjectOnly) {
        return (
          b.subject === item.subject &&
          Number(b.semester) === Number(item.semester) &&
          !b.unit
        );
      }
      return (
        b.subject === item.subject &&
        Number(b.semester) === Number(item.semester) &&
        Number(b.unit) === Number(item.unit)
      );
    });

    let updated;
    if (exists) {
      updated = bookmarks.filter((b) => {
        if (isSubjectOnly) {
          return !(b.subject === item.subject && Number(b.semester) === Number(item.semester) && !b.unit);
        }
        return !(b.subject === item.subject && Number(b.semester) === Number(item.semester) && Number(b.unit) === Number(item.unit));
      });
    } else {
      updated = [
        ...bookmarks,
        {
          resourceId: item.resourceId || "",
          subject: item.subject,
          semester: Number(item.semester),
          unit: item.unit ? Number(item.unit) : null,
          title: item.title || `${item.subject} ${item.unit ? `Unit ${item.unit}` : ""}`.trim(),
          link: item.link || "",
          savedAt: new Date().toISOString(),
        },
      ];
    }

    setBookmarks(updated);
    localStorage.setItem("srm-student-bookmarks", JSON.stringify(updated));

    // Persist to backend if token exists
    if (studentToken) {
      try {
        await axios.post(
          `${API_BASE}/api/student-auth/bookmarks`,
          {
            resourceId: item.resourceId,
            subject: item.subject,
            semester: Number(item.semester),
            unit: item.unit ? Number(item.unit) : null,
            title: item.title,
            link: item.link,
          },
          {
            headers: { Authorization: `Bearer ${studentToken}` },
          }
        );
      } catch (err) {
        console.warn("Bookmark toggle server error:", err.message);
      }
    }
  }

  /* =======================================================
     LOAD RESOURCES
  ======================================================= */

  async function loadResources() {
    try {
      setLoadingResources(true);
      setResourceError("");

      const response = await axios.get(
        `${API_BASE}/api/resources`
      );

      const data = response.data;

      if (Array.isArray(data)) {
        setResources(data);
      } else if (
        Array.isArray(data.resources)
      ) {
        setResources(data.resources);
      } else {
        setResources([]);
      }
    } catch (error) {
      console.error(
        "Resource loading error:",
        error
      );

      setResourceError(
        error.response?.data?.message ||
          "Unable to load resources. Make sure the backend is running."
      );
    } finally {
      setLoadingResources(false);
    }
  }

  useEffect(() => {
    loadResources();
  }, []);

  /* =======================================================
     LOAD ADMIN RESOURCES
  ======================================================= */

  async function loadAdminResources() {
    try {
      setAdminLoading(true);

      const token =
        localStorage.getItem(
          "srm_admin_token"
        );

      const response = await axios.get(
        `${API_BASE}/api/resources`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      );

      const data = response.data;

      if (Array.isArray(data)) {
        setAdminResources(data);
      } else if (
        Array.isArray(data.resources)
      ) {
        setAdminResources(data.resources);
      } else {
        setAdminResources([]);
      }
    } catch (error) {
      console.error(
        "Admin resource loading error:",
        error
      );

      showAdminNotice(
        error.response?.data?.message ||
          "Unable to load resources.",
        "error"
      );
    } finally {
      setAdminLoading(false);
    }
  }

  /* =======================================================
     ADMIN NOTICE
  ======================================================= */

  function showAdminNotice(
    message,
    type = "success"
  ) {
    setAdminNotice({
      message,
      type,
    });

    setTimeout(() => {
      setAdminNotice(null);
    }, 3500);
  }

  /* =======================================================
     NAVIGATION
  ======================================================= */

  function goHome() {
    setPage("home");
    setSelectedSemester(null);
    setSelectedSubject(null);
    setSearchTerm("");
  }

  function openSemester(semester) {
    setSelectedSemester(semester);
    setSelectedSubject(null);
    setPage("semester");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openSubject(
    semester,
    subject
  ) {
    setSelectedSemester(semester);
    setSelectedSubject(subject);
    setPage("subject");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openSearch() {
    setPage("search");
    setSelectedSemester(null);
    setSelectedSubject(null);
  }

  function openGpa() {
    setPage("gpa");
    setSelectedSemester(null);
    setSelectedSubject(null);
  }

  function openAdminLogin() {
    setPage("admin-login");
  }

  function openAdmin() {
    if (!adminLoggedIn) {
      openAdminLogin();
      return;
    }

    setPage("admin");
    setAdminSection("dashboard");
    loadAdminResources();
  }

  /* =======================================================
     FILTERED SEARCH
  ======================================================= */

  const searchResults = useMemo(() => {
    const query =
      searchTerm.trim().toLowerCase();

    if (!query) return [];

    return resources.filter((item) =>
      String(item.subject || "")
        .toLowerCase()
        .includes(query)
    );
  }, [resources, searchTerm]);

  /* =======================================================
     SELECTED RESOURCE
  ======================================================= */

  const selectedResource = useMemo(() => {
    if (!selectedSubject) return null;

    return resources.find(
      (item) =>
        Number(item.semester) ===
          Number(selectedSemester) &&
        String(item.subject || "")
          .trim()
          .toLowerCase() ===
          String(selectedSubject || "")
            .trim()
            .toLowerCase()
    );
  }, [
    resources,
    selectedSemester,
    selectedSubject,
  ]);

  /* =======================================================
     ADMIN FORM
  ======================================================= */

  function resetAdminForm() {
    setAdminForm({
      semester: "1",
      subject: "",
      unit1: "",
      unit2: "",
      unit3: "",
      unit4: "",
      unit5: "",
      pyq: "",
    });

    setEditingResource(null);
  }

  function editResource(resource) {
    setEditingResource(resource);

    setAdminForm({
      semester: String(
        resource.semester || 1
      ),

      subject: resource.subject || "",

      unit1: resource.unit1 || "",
      unit2: resource.unit2 || "",
      unit3: resource.unit3 || "",
      unit4: resource.unit4 || "",
      unit5: resource.unit5 || "",

      pyq: resource.pyq || "",
    });

    setAdminSection("add");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function updateAdminForm(
    field,
    value
  ) {
    setAdminForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  /* =======================================================
     CREATE / UPDATE RESOURCE
  ======================================================= */

  async function saveResource(event) {
    event.preventDefault();

    if (!adminForm.subject.trim()) {
      showAdminNotice(
        "Please select a subject.",
        "error"
      );

      return;
    }

    try {
      const token =
        localStorage.getItem(
          "srm_admin_token"
        );

      const config = token
        ? {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        : {};

      const payload = {
        semester: Number(
          adminForm.semester
        ),

        subject:
          adminForm.subject.trim(),

        unit1: adminForm.unit1,
        unit2: adminForm.unit2,
        unit3: adminForm.unit3,
        unit4: adminForm.unit4,
        unit5: adminForm.unit5,

        pyq: adminForm.pyq,
      };

      if (editingResource) {
        await axios.put(
          `${API_BASE}/api/resources/${editingResource._id}`,
          payload,
          config
        );

        showAdminNotice(
          "Resource updated successfully."
        );
      } else {
        await axios.post(
          `${API_BASE}/api/resources`,
          payload,
          config
        );

        showAdminNotice(
          "Resource created successfully."
        );
      }

      resetAdminForm();

      await loadAdminResources();
      await loadResources();

      setAdminSection("documents");
    } catch (error) {
      console.error(
        "Save resource error:",
        error
      );

      showAdminNotice(
        error.response?.data?.message ||
          "Unable to save resource.",
        "error"
      );
    }
  }

  /* =======================================================
     DELETE RESOURCE
  ======================================================= */

  async function confirmDeleteResource() {
    if (!deleteResource) return;

    try {
      const token =
        localStorage.getItem(
          "srm_admin_token"
        );

      await axios.delete(
        `${API_BASE}/api/resources/${deleteResource._id}`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      );

      showAdminNotice(
        "Resource deleted successfully."
      );

      setDeleteResource(null);

      await loadAdminResources();
      await loadResources();
    } catch (error) {
      console.error(
        "Delete resource error:",
        error
      );

      showAdminNotice(
        error.response?.data?.message ||
          "Unable to delete resource.",
        "error"
      );
    }
  }

  /* =======================================================
     ADMIN LOGOUT
  ======================================================= */

  function logoutAdmin() {
    localStorage.removeItem(
      "srm_admin_token"
    );

    localStorage.removeItem(
      "srm_admin_username"
    );

    setAdminLoggedIn(false);
    setAdminUsername("");
    setPage("home");
  }

  /* =======================================================
     THEME & APPEARANCE
  ======================================================= */

  const glowMultipliers = {
    low: 0.1,
    medium: 0.22,
    high: 0.45,
  };

  const currentGlowAlpha = glowMultipliers[glowIntensity] || 0.22;

  const themeValues = {
    "aurora-cyan": {
      primary: "#22d3ee",
      secondary: "#06b6d4",
      glow: `rgba(34,211,238,${currentGlowAlpha})`,
    },

    "royal-purple": {
      primary: "#a78bfa",
      secondary: "#8b5cf6",
      glow: `rgba(139,92,246,${currentGlowAlpha})`,
    },

    "deep-ocean": {
      primary: "#38bdf8",
      secondary: "#0284c7",
      glow: `rgba(56,189,248,${currentGlowAlpha})`,
    },

    emerald: {
      primary: "#34d399",
      secondary: "#10b981",
      glow: `rgba(16,185,129,${currentGlowAlpha})`,
    },

    cyan: {
      primary: "#22d3ee",
      secondary: "#06b6d4",
      glow: `rgba(34,211,238,${currentGlowAlpha})`,
    },

    purple: {
      primary: "#a78bfa",
      secondary: "#8b5cf6",
      glow: `rgba(139,92,246,${currentGlowAlpha})`,
    },

    orange: {
      primary: "#fb923c",
      secondary: "#f97316",
      glow: `rgba(249,115,22,${currentGlowAlpha})`,
    },

    green: {
      primary: "#34d399",
      secondary: "#10b981",
      glow: `rgba(16,185,129,${currentGlowAlpha})`,
    },

    pink: {
      primary: "#f472b6",
      secondary: "#ec4899",
      glow: `rgba(236,72,153,${currentGlowAlpha})`,
    },
  };

  const selectedTheme =
    themeValues[theme] ||
    themeValues["aurora-cyan"] ||
    themeValues.cyan;

  /* =======================================================
     HOME PAGE
  ======================================================= */

  function HomePage() {
    const totalSubjects =
      Object.values(subjects).reduce(
        (sum, list) =>
          sum + list.length,
        0
      );

    return (
      <>
        <section className="hero">
          <div className="hero-content">
            <div className="hero-badge">
              ✦ SRM STUDENT RESOURCE HUB
            </div>

            <h1>
              Find your
              <br />
              <span>notes.</span>
            </h1>

            <p>
              A simple place to access
              semester notes, study
              material, previous year
              questions and academic
              resources.
            </p>

            <div className="hero-actions">
              <button
                className="primary-button large"
                onClick={() => {
                  const el = document.querySelector(".semester-grid");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  } else {
                    window.scrollTo({ top: 500, behavior: "smooth" });
                  }
                }}
              >
                Explore Notes →
              </button>

              <button
                className="secondary-button"
                onClick={openSearch}
              >
                Search Resources
              </button>
            </div>

            <div className="hero-status">
              <span
                className={`status-dot ${serverStatus}`}
              />

              {serverStatus ===
                "online" &&
                "Database connected"}

              {serverStatus ===
                "offline" &&
                "Backend offline"}

              {serverStatus ===
                "checking" &&
                "Checking server..."}
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-glow glow-one" />
            <div className="hero-glow glow-two" />

            <div className="orb">
              <div className="orb-inner">
                SRM
              </div>
            </div>

            <div className="floating-card card-one">
              <span>📚</span>

              <div>
                <strong>
                  8 Semesters
                </strong>

                <small>
                  Organized resources
                </small>
              </div>
            </div>

            <div className="floating-card card-two">
              <span>📝</span>

              <div>
                <strong>
                  PYQ Papers
                </strong>

                <small>
                  Exam preparation
                </small>
              </div>
            </div>

            <div className="floating-card card-three">
              <span>⚡</span>

              <div>
                <strong>
                  Fast Search
                </strong>

                <small>
                  Find resources quickly
                </small>
              </div>
            </div>
          </div>
        </section>

        <section className="stats-section">
          <StatCard
            icon="🎓"
            value="8"
            label="Semesters"
          />

          <StatCard
            icon="📚"
            value={totalSubjects}
            label="Subjects"
          />

          <StatCard
            icon="📄"
            value={getTotalResources(
              resources
            )}
            label="Resources"
          />

          <StatCard
            icon="🔎"
            value="Fast"
            label="Resource Search"
          />
        </section>

        {bookmarks.length > 0 && (
          <section className="bookmarked-section">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#fbbf24", letterSpacing: "1px", textTransform: "uppercase" }}>
                  ★ QUICK ACCESS
                </span>
                <h2 style={{ margin: "4px 0 0 0", fontSize: "20px", fontWeight: "700", color: "#f8fafc" }}>
                  Your Bookmarked Subjects & Notes
                </h2>
              </div>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                {bookmarks.length} saved item{bookmarks.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="bookmarked-grid">
              {bookmarks.map((bm, index) => (
                <div
                  key={`${bm.subject}-${bm.semester}-${bm.unit || "all"}-${index}`}
                  className="bookmarked-card"
                  onClick={() => {
                    openSubject(bm.semester, bm.subject);
                  }}
                >
                  <div className="bookmarked-info">
                    <h4>{bm.title || bm.subject}</h4>
                    <span>Semester {bm.semester} {bm.unit ? `• Unit ${bm.unit}` : "• Full Subject"}</span>
                  </div>
                  <button
                    className="unit-bookmark-toggle bookmarked"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleBookmark(bm);
                    }}
                    title="Remove from favorites"
                  >
                    ★
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <SectionHeading
            eyebrow="ACADEMICS"
            title="Choose your semester"
            description="Select a semester to view its subjects and study resources."
          />

          <div className="semester-grid">
            {Object.keys(subjects).map(
              (semester) => (
                <SemesterCard
                  key={semester}
                  semester={semester}
                  count={
                    subjects[
                      semester
                    ].length
                  }
                  onClick={() =>
                    openSemester(
                      Number(semester)
                    )
                  }
                />
              )
            )}
          </div>
        </section>
      </>
    );
  }

  /* =======================================================
     SEMESTER PAGE
  ======================================================= */

  function SemesterPage() {
    const list =
      subjects[selectedSemester] ||
      [];

    return (
      <main className="page-container">
        <button
          className="back-button"
          onClick={goHome}
        >
          ← Back Home
        </button>

        <div className="section-heading semester-page-heading">
          <div className="eyebrow">
            SEMESTER {selectedSemester}
          </div>

          <h1>
            Semester {selectedSemester}
          </h1>

          <p>
            Choose a subject to access
            notes and previous year
            questions.
          </p>
        </div>

        <div className="subject-grid">
          {list.map(
            (subject, index) => (
              <SubjectCard
                key={subject}
                subject={subject}
                semester={
                  selectedSemester
                }
                index={index}
                onClick={() =>
                  openSubject(
                    selectedSemester,
                    subject
                  )
                }
              />
            )
          )}
        </div>
      </main>
    );
  }

  /* =======================================================
     SUBJECT PAGE
  ======================================================= */

  function SubjectPage() {
    const resource =
      selectedResource;

    return (
      <main className="page-container">
        <button
          className="back-button"
          onClick={() =>
            openSemester(
              selectedSemester
            )
          }
        >
          ← Back to Semester
        </button>

        <div className="subject-heading">
          <div>
            <div className="eyebrow">
              SEMESTER{" "}
              {selectedSemester}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginTop: "4px" }}>
              <h1>
                {selectedSubject}
              </h1>

              {selectedSubject && (
                <>
                  <button
                    className={`bookmark-btn ${
                      bookmarks.some(
                        (b) =>
                          b.subject === selectedSubject &&
                          Number(b.semester) === Number(selectedSemester) &&
                          !b.unit
                      )
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      handleToggleBookmark({
                        resourceId: resource?._id || "",
                        subject: selectedSubject,
                        semester: Number(selectedSemester),
                        title: `${selectedSubject} (All Notes)`,
                      })
                    }
                    title="Bookmark this subject to your quick-access dashboard"
                  >
                    <span>
                      {bookmarks.some(
                        (b) =>
                          b.subject === selectedSubject &&
                          Number(b.semester) === Number(selectedSemester) &&
                          !b.unit
                      )
                        ? "★ Bookmarked"
                        : "☆ Bookmark Subject"}
                    </span>
                  </button>

                  <button
                    className="share-whatsapp-btn"
                    onClick={() => {
                      const shareText = `📚 *${selectedSubject}* - Semester ${selectedSemester} Notes, Question Papers (PYQs), and PPTs are available here for free on SRM Note Finder:\n\n🔗 ${window.location.origin}`;
                      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
                      window.open(whatsappUrl, "_blank");
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #25D366, #128C7E)",
                      color: "#ffffff",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: "700",
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(37, 211, 102, 0.35)",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 6px 18px rgba(37, 211, 102, 0.45)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 14px rgba(37, 211, 102, 0.35)";
                    }}
                    title="Share these notes directly to your class WhatsApp group"
                  >
                    <span>📲</span> Share to WhatsApp
                  </button>
                </>
              )}
            </div>

            <p>
              Study material, engineering summaries, doubts solver, and previous
              year examination papers.
            </p>
          </div>

          <div className="database-pill">
            <span
              className={`status-dot ${
                serverStatus === "online"
                  ? "online"
                  : serverStatus ===
                    "offline"
                  ? "offline"
                  : "checking"
              }`}
            />

            Live resource database
          </div>
        </div>

        {loadingResources ? (
          <div className="loading-box">
            <div className="spinner" />
            Loading resources...
          </div>
        ) : resourceError ? (
          <div className="error-box">
            <h3>
              Unable to load resources
            </h3>

            <p>
              {resourceError}
            </p>

            <button
              className="primary-button"
              onClick={
                loadResources
              }
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="resource-grid">
            {[1, 2, 3, 4, 5].map(
              (unit) => {
                const isUnitBookmarked = bookmarks.some(
                  (b) =>
                    b.subject === selectedSubject &&
                    Number(b.semester) === Number(selectedSemester) &&
                    Number(b.unit) === unit
                );

                return (
                  <ResourceCard
                    key={unit}
                    unit={unit}
                    subject={selectedSubject}
                    links={normalizeLinks(
                      resource?.[
                        `unit${unit}`
                      ]
                    )}
                    isBookmarked={isUnitBookmarked}
                    onToggleBookmark={() =>
                      handleToggleBookmark({
                        resourceId: resource?._id || "",
                        subject: selectedSubject,
                        semester: Number(selectedSemester),
                        unit,
                        title: `${selectedSubject} - Unit ${unit}`,
                        link: normalizeLinks(resource?.[`unit${unit}`])[0] || "",
                      })
                    }
                  />
                );
              }
            )}

            <PyqCard
              links={normalizeLinks(
                resource?.pyq
              )}
              subject={selectedSubject}
            />
          </div>
        )}
      </main>
    );
  }

  /* =======================================================
     SEARCH PAGE
  ======================================================= */

  function SearchPage() {
    return (
      <main className="page-container">
        <SectionHeading
          eyebrow="RESOURCE SEARCH"
          title="Search notes"
          description="Search your subject resources from one place."
        />

        <div className="search-box">
          <span>⌕</span>

          <input
            value={searchTerm}
            onChange={(e) =>
              setSearchTerm(
                e.target.value
              )
            }
            placeholder="Search subject..."
            autoFocus
          />

          {searchTerm && (
            <button
              onClick={() =>
                setSearchTerm("")
              }
            >
              ×
            </button>
          )}
        </div>

        {searchTerm && (
          <div className="search-count">
            {searchResults.length} result
            {searchResults.length !==
            1
              ? "s"
              : ""}{" "}
            found
          </div>
        )}

        {!searchTerm ? (
          <div className="empty-box">
            <div className="empty-icon">
              🔎
            </div>

            <h3>
              Start searching
            </h3>

            <p>
              Type a subject name above.
            </p>
          </div>
        ) : searchResults.length ===
          0 ? (
          <div className="empty-box">
            <div className="empty-icon">
              😕
            </div>

            <h3>
              No results found
            </h3>

            <p>
              Try a different subject
              name.
            </p>
          </div>
        ) : (
          <div className="subject-grid">
            {searchResults.map(
              (item, index) => (
                <SubjectCard
                  key={
                    item._id ||
                    `${item.subject}-${index}`
                  }
                  subject={
                    item.subject
                  }
                  semester={
                    item.semester
                  }
                  index={index}
                  onClick={() =>
                    openSubject(
                      item.semester,
                      item.subject
                    )
                  }
                />
              )
            )}
          </div>
        )}
      </main>
    );
  }

  /* =======================================================
     GPA PAGE
  ======================================================= */

  function GpaPage() {
    const [rows, setRows] =
      useState([
        {
          subject: "",
          credits: 3,
          grade: "O",
        },
      ]);

    const [semesterRows, setSemesterRows] =
      useState(
        Array.from(
          { length: 8 },
          (_, index) => ({
            semester: index + 1,
            gpa: "",
          })
        )
      );

    const gradePoints = {
      O: 10,
      "A+": 9,
      A: 8,
      "B+": 7,
      B: 6,
      C: 5,
      F: 0,
    };

    function addRow() {
      setRows((previous) => [
        ...previous,
        {
          subject: "",
          credits: 3,
          grade: "O",
        },
      ]);
    }

    function removeRow(index) {
      setRows((previous) =>
        previous.filter(
          (_, i) => i !== index
        )
      );
    }

    function updateRow(
      index,
      field,
      value
    ) {
      setRows((previous) =>
        previous.map((row, i) =>
          i === index
            ? {
                ...row,
                [field]: value,
              }
            : row
        )
      );
    }

    const sgpa = useMemo(() => {
      let totalCredits = 0;
      let totalPoints = 0;

      rows.forEach((row) => {
        const credits =
          Number(row.credits) || 0;

        const points =
          gradePoints[row.grade] ||
          0;

        totalCredits += credits;

        totalPoints +=
          credits * points;
      });

      if (!totalCredits)
        return "0.00";

      return (
        totalPoints / totalCredits
      ).toFixed(2);
    }, [rows]);

    const cgpa = useMemo(() => {
      const values =
        semesterRows
          .map((row) =>
            Number(row.gpa)
          )
          .filter(
            (value) =>
              !Number.isNaN(value) &&
              value >= 0 &&
              value <= 10
          );

      if (!values.length)
        return "0.00";

      const total =
        values.reduce(
          (sum, value) =>
            sum + value,
          0
        );

      return (
        total / values.length
      ).toFixed(2);
    }, [semesterRows]);

    function updateSemesterGpa(
      index,
      value
    ) {
      setSemesterRows(
        (previous) =>
          previous.map(
            (row, i) =>
              i === index
                ? {
                    ...row,
                    gpa: value,
                  }
                : row
          )
      );
    }

    return (
      <main className="page-container">
        <SectionHeading
          eyebrow="GPA+"
          title="Calculate your GPA"
          description="Calculate SGPA and keep track of your semester GPA."
        />

        <div className="gpa-layout">
          <div className="gpa-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  SGPA Calculator
                </h2>

                <p>
                  Enter subjects, credits
                  and grades.
                </p>
              </div>

              <ScoreBox
                label="SGPA"
                value={sgpa}
              />
            </div>

            <div className="gpa-table">
              <div className="gpa-header">
                <span>Subject</span>
                <span>Credits</span>
                <span>Grade</span>
                <span />
              </div>

              {rows.map(
                (row, index) => (
                  <div
                    className="gpa-row"
                    key={index}
                  >
                    <input
                      value={
                        row.subject
                      }
                      onChange={(e) =>
                        updateRow(
                          index,
                          "subject",
                          e.target.value
                        )
                      }
                      placeholder="Subject"
                    />

                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={
                        row.credits
                      }
                      onChange={(e) =>
                        updateRow(
                          index,
                          "credits",
                          e.target.value
                        )
                      }
                    />

                    <select
                      value={
                        row.grade
                      }
                      onChange={(e) =>
                        updateRow(
                          index,
                          "grade",
                          e.target.value
                        )
                      }
                    >
                      {Object.keys(
                        gradePoints
                      ).map(
                        (grade) => (
                          <option
                            key={grade}
                            value={grade}
                          >
                            {grade} -{" "}
                            {
                              gradePoints[
                                grade
                              ]
                            }
                          </option>
                        )
                      )}
                    </select>

                    <button
                      className="remove-button"
                      onClick={() =>
                        removeRow(
                          index
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="gpa-actions">
              <button
                className="secondary-button"
                onClick={addRow}
              >
                + Add Subject
              </button>
            </div>

            <div className="grade-reference">
              <h3>
                Grade Reference
              </h3>

              <div className="grade-grid">
                {Object.entries(
                  gradePoints
                ).map(
                  ([grade, points]) => (
                    <div key={grade}>
                      <strong>
                        {grade}
                      </strong>

                      <span>
                        {points}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="gpa-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  CGPA Tracker
                </h2>

                <p>
                  Enter your semester
                  GPAs.
                </p>
              </div>

              <ScoreBox
                label="CGPA"
                value={cgpa}
              />
            </div>

            <div className="semester-gpa-list">
              {semesterRows.map(
                (row, index) => (
                  <div
                    className="semester-gpa-row"
                    key={
                      row.semester
                    }
                  >
                    <span>
                      Semester{" "}
                      {row.semester}
                    </span>

                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.01"
                      value={
                        row.gpa
                      }
                      onChange={(e) =>
                        updateSemesterGpa(
                          index,
                          e.target.value
                        )
                      }
                      placeholder="GPA"
                    />

                    <span />
                  </div>
                )
              )}
            </div>

            <div className="no-link">
              CGPA is calculated as the
              average of the entered
              semester GPAs.
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* =======================================================
     ADMIN LOGIN
  ======================================================= */

  function AdminLoginPage() {
    const [username, setUsername] =
      useState("");

    const [password, setPassword] =
      useState("");

    const [error, setError] =
      useState("");

    const [loading, setLoading] =
      useState(false);

    async function login(event) {
      event.preventDefault();

      setError("");

      if (!username || !password) {
        setError(
          "Please enter username and password."
        );

        return;
      }

      try {
        setLoading(true);

        const response =
          await axios.post(
            `${API_BASE}/api/admin/login`,
            {
              username,
              password,
            }
          );

        const token =
          response.data.token;

        if (!token) {
          setError(
            "Login failed. No token received."
          );

          return;
        }

        localStorage.setItem(
          "srm_admin_token",
          token
        );

        localStorage.setItem(
          "srm_admin_username",
          username
        );

        setAdminLoggedIn(true);
        setAdminUsername(username);

        setPage("admin");
        setAdminSection(
          "dashboard"
        );

        loadAdminResources();
      } catch (error) {
        console.error(
          "Admin login error:",
          error
        );

        setError(
          error.response?.data?.message ||
            "Login failed."
        );
      } finally {
        setLoading(false);
      }
    }

    return (
      <main className="login-page">
        <div className="login-card">
          <div className="login-icon">
            🔐
          </div>

          <div className="eyebrow">
            ADMIN ACCESS
          </div>

          <h1>
            Welcome back
          </h1>

          <p>
            Sign in to manage SRM Note
            Finder resources.
          </p>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <form onSubmit={login}>
            <label>
              Username
            </label>

            <input
              className="large-input"
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value
                )
              }
              placeholder="Admin username"
            />

            <label>
              Password
            </label>

            <input
              className="large-input"
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              placeholder="Admin password"
            />

            <button
              className="primary-button"
              disabled={loading}
              type="submit"
            >
              {loading
                ? "Signing in..."
                : "Sign In"}
            </button>
          </form>

          <div className="login-server">
            <span
              className={`status-dot ${serverStatus}`}
            />

            Backend:{" "}
            {serverStatus}
          </div>
        </div>
      </main>
    );
  }

  /* =======================================================
     ADMIN DASHBOARD
  ======================================================= */

  function AdminDashboard() {
    if (!adminLoggedIn) {
      return (
        <AdminLoginPage />
      );
    }

    const totalDocuments =
      adminResources.length;

    const totalLinks =
      getTotalResources(
        adminResources
      );

    const totalSubjects =
      new Set(
        adminResources.map(
          (item) => item.subject
        )
      ).size;

    return (
      <main className="admin-dashboard">
        <div className="admin-top">
          <div>
            <div className="eyebrow">
              ADMIN PANEL
            </div>

            <h1>
              Dashboard
            </h1>

            <p>
              Welcome{" "}
              {adminUsername
                ? adminUsername
                : "Admin"}
              . Manage your SRM Note
              Finder resources.
            </p>
          </div>

          <div className="system-status">
            <span
              className={`status-dot ${serverStatus}`}
            />

            Backend{" "}
            {serverStatus}
          </div>
        </div>

        <div className="admin-layout">
          <aside className="admin-sidebar">
            <button
              className={`sidebar-item ${
                adminSection ===
                "dashboard"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setAdminSection(
                  "dashboard"
                )
              }
            >
              📊 Dashboard
            </button>

            <button
              className={`sidebar-item ${
                adminSection ===
                "documents"
                  ? "active"
                  : ""
              }`}
              onClick={() => {
                setAdminSection(
                  "documents"
                );

                loadAdminResources();
              }}
            >
              📄 Documents
            </button>

            <button
              className={`sidebar-item ${
                adminSection === "add"
                  ? "active"
                  : ""
              }`}
              onClick={() => {
                resetAdminForm();

                setAdminSection(
                  "add"
                );
              }}
            >
              ➕ Add Resource
            </button>

            <button
              className={`sidebar-item ${
                adminSection ===
                "semesters"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setAdminSection(
                  "semesters"
                )
              }
            >
              🎓 Semesters
            </button>

            <button
              className={`sidebar-item ${
                adminSection ===
                "subjects"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setAdminSection(
                  "subjects"
                )
              }
            >
              📚 Subjects
            </button>

            <button
              className="sidebar-item logout-sidebar"
              onClick={
                logoutAdmin
              }
            >
              🚪 Logout
            </button>
          </aside>

          <section className="admin-content">
            {adminSection ===
              "dashboard" && (
              <>
                <div className="admin-stat-grid">
                  <div className="admin-stat">
                    <div className="admin-stat-icon">
                      📄
                    </div>

                    <div>
                      <strong>
                        {
                          totalDocuments
                        }
                      </strong>

                      <span>
                        Documents
                      </span>
                    </div>
                  </div>

                  <div className="admin-stat">
                    <div className="admin-stat-icon">
                      🔗
                    </div>

                    <div>
                      <strong>
                        {totalLinks}
                      </strong>

                      <span>
                        Resource Links
                      </span>
                    </div>
                  </div>

                  <div className="admin-stat">
                    <div className="admin-stat-icon">
                      📚
                    </div>

                    <div>
                      <strong>
                        {
                          totalSubjects
                        }
                      </strong>

                      <span>
                        Subjects
                      </span>
                    </div>
                  </div>

                  <div className="admin-stat">
                    <div className="admin-stat-icon">
                      🎓
                    </div>

                    <div>
                      <strong>
                        8
                      </strong>

                      <span>
                        Semesters
                      </span>
                    </div>
                  </div>
                </div>

                <div className="dashboard-panel">
                  <div className="panel-title-row">
                    <div>
                      <h2>
                        Resource overview
                      </h2>

                      <p>
                        Current database
                        summary.
                      </p>
                    </div>

                    <button
                      className="text-button"
                      onClick={
                        loadAdminResources
                      }
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="mini-stat-grid">
                    <div>
                      <strong>
                        {
                          totalDocuments
                        }
                      </strong>

                      <span>
                        Resource records
                      </span>
                    </div>

                    <div>
                      <strong>
                        {totalLinks}
                      </strong>

                      <span>
                        Links
                      </span>
                    </div>

                    <div>
                      <strong>
                        {
                          Object.values(
                            subjects
                          ).flat().length
                        }
                      </strong>

                      <span>
                        Available subjects
                      </span>
                    </div>
                  </div>
                </div>

                <div className="dashboard-panel">
                  <div className="panel-title-row">
                    <div>
                      <h2>
                        Recent resources
                      </h2>

                      <p>
                        Latest records from
                        MongoDB.
                      </p>
                    </div>
                  </div>

                  {adminResources.length ===
                  0 ? (
                    <div className="empty-small">
                      No resources found.
                    </div>
                  ) : (
                    adminResources
                      .slice(0, 6)
                      .map(
                        (item) => (
                          <div
                            className="recent-row"
                            key={
                              item._id
                            }
                          >
                            <div>
                              <strong>
                                {
                                  item.subject
                                }
                              </strong>

                              <span>
                                Semester{" "}
                                {
                                  item.semester
                                }
                              </span>
                            </div>

                            <span>
                              {formatDate(
                                item.createdAt
                              )}
                            </span>
                          </div>
                        )
                      )
                  )}
                </div>
              </>
            )}

            {adminSection ===
              "documents" && (
              <div className="dashboard-panel">
                <div className="panel-title-row">
                  <div>
                    <h2>
                      Documents
                    </h2>

                    <p>
                      Edit and delete
                      resources.
                    </p>
                  </div>

                  <button
                    className="primary-button"
                    onClick={() => {
                      resetAdminForm();

                      setAdminSection(
                        "add"
                      );
                    }}
                  >
                    + Add
                  </button>
                </div>

                <div className="resource-toolbar">
                  <button
                    className="secondary-button"
                    onClick={
                      loadAdminResources
                    }
                  >
                    Refresh
                  </button>
                </div>

                <div className="resource-table-wrapper">
                  <div className="resource-table-header">
                    <span>
                      Subject
                    </span>

                    <span>
                      Semester
                    </span>

                    <span>
                      Units
                    </span>

                    <span>
                      PYQ
                    </span>

                    <span>
                      Actions
                    </span>
                  </div>

                  {adminLoading ? (
                    <div className="table-loading">
                      Loading...
                    </div>
                  ) : adminResources.length ===
                    0 ? (
                    <div className="table-empty">
                      No resources found.
                    </div>
                  ) : (
                    adminResources.map(
                      (item) => (
                        <ResourceRow
                          key={
                            item._id
                          }
                          item={item}
                          onEdit={
                            editResource
                          }
                          onDelete={
                            setDeleteResource
                          }
                        />
                      )
                    )
                  )}
                </div>
              </div>
            )}

            {adminSection ===
              "add" && (
              <div className="dashboard-panel">
                <div className="panel-title-row">
                  <div>
                    <h2>
                      {editingResource
                        ? "Edit Resource"
                        : "Add Resource"}
                    </h2>

                    <p>
                      Add study material
                      and PYQ links.
                    </p>
                  </div>
                </div>

                <form
                  className="admin-form"
                  onSubmit={
                    saveResource
                  }
                >
                  <div className="form-grid-two">
                    <AdminInput
                      label="Semester"
                      type="select"
                      value={
                        adminForm.semester
                      }
                      onChange={(
                        value
                      ) =>
                        updateAdminForm(
                          "semester",
                          value
                        )
                      }
                      options={Object.keys(
                        subjects
                      ).map(
                        (semester) => ({
                          value:
                            semester,

                          label:
                            `Semester ${semester}`,
                        })
                      )}
                    />

                    <AdminInput
                      label="Subject"
                      type="select"
                      value={
                        adminForm.subject
                      }
                      onChange={(
                        value
                      ) =>
                        updateAdminForm(
                          "subject",
                          value
                        )
                      }
                      options={[
                        {
                          value: "",
                          label:
                            "Select subject",
                        },

                        ...(
                          subjects[
                            Number(
                              adminForm.semester
                            )
                          ] || []
                        ).map(
                          (subject) => ({
                            value:
                              subject,

                            label:
                              subject,
                          })
                        ),
                      ]}
                    />
                  </div>

                  <div className="unit-form-grid">
                    {[1, 2, 3, 4, 5].map(
                      (unit) => (
                        <AdminInput
                          key={unit}
                          label={`Unit ${unit} Links`}
                          value={
                            adminForm[
                              `unit${unit}`
                            ]
                          }
                          onChange={(
                            value
                          ) =>
                            updateAdminForm(
                              `unit${unit}`,
                              value
                            )
                          }
                          textarea
                          placeholder="Paste Google Drive links. Use one link per line."
                        />
                      )
                    )}
                  </div>

                  <AdminInput
                    label="PYQ Links"
                    value={
                      adminForm.pyq
                    }
                    onChange={(value) =>
                      updateAdminForm(
                        "pyq",
                        value
                      )
                    }
                    textarea
                    placeholder="Paste PYQ Google Drive links. Use one link per line."
                  />

                  <div className="form-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={
                        resetAdminForm
                      }
                    >
                      Clear
                    </button>

                    <button
                      type="submit"
                      className="primary-button"
                    >
                      {editingResource
                        ? "Update Resource"
                        : "Save Resource"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {adminSection ===
              "semesters" && (
              <div className="dashboard-panel">
                <div className="panel-title-row">
                  <div>
                    <h2>
                      Semesters
                    </h2>

                    <p>
                      Manage semester
                      resource structure.
                    </p>
                  </div>
                </div>

                <div className="semester-grid admin-semester-grid">
                  {Object.keys(
                    subjects
                  ).map(
                    (semester) => (
                      <SemesterCard
                        key={
                          semester
                        }
                        semester={
                          semester
                        }
                        count={
                          subjects[
                            semester
                          ].length
                        }
                        onClick={() => {
                          setAdminSection(
                            "subjects"
                          );
                        }}
                      />
                    )
                  )}
                </div>
              </div>
            )}

            {adminSection ===
              "subjects" && (
              <div className="dashboard-panel">
                <div className="panel-title-row">
                  <div>
                    <h2>
                      Subjects
                    </h2>

                    <p>
                      All configured
                      subjects.
                    </p>
                  </div>
                </div>

                {Object.entries(
                  subjects
                ).map(
                  ([
                    semester,
                    list,
                  ]) => (
                    <div
                      key={
                        semester
                      }
                      className="admin-subject-group"
                    >
                      <h3>
                        Semester{" "}
                        {semester}
                      </h3>

                      <div className="subject-grid">
                        {list.map(
                          (
                            subject,
                            index
                          ) => (
                            <SubjectCard
                              key={
                                subject
                              }
                              subject={
                                subject
                              }
                              semester={
                                semester
                              }
                              index={
                                index
                              }
                              onClick={() =>
                                openSubject(
                                  Number(
                                    semester
                                  ),
                                  subject
                                )
                              }
                            />
                          )
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  /* =======================================================
     USER TRACKING
  ======================================================= */

  const trackerPage =
    page === "subject"
      ? "subject"
      : page === "semester"
      ? "semester"
      : page === "search"
      ? "search"
      : page === "gpa"
      ? "gpa"
      : page === "admin"
      ? "admin"
      : page === "admin-login"
      ? "admin-login"
      : "home";

  /* =======================================================
     APP RENDER
  ======================================================= */

  return (
    <div
      className={`app background-${background}`}
      style={{
        "--accent-primary":
          selectedTheme.primary,
        "--accent-secondary":
          selectedTheme.secondary,
        "--accent-glow":
          selectedTheme.glow,
      }}
    >
      <UserTracker
        page={trackerPage}
        semester={selectedSemester}
        selectedSubject={selectedSubject}
        email={studentEmail}
      />

      {/* =====================================================
          NAVBAR
      ===================================================== */}

      {page === "community" ? (
        <nav
          className="navbar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 18px",
          }}
        >
          <button
            onClick={goHome}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "14px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "rgba(15, 23, 42, 0.8)",
              color: "#f8fafc",
              fontSize: "14px",
              fontWeight: "750",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(34, 211, 238, 0.18)";
              e.currentTarget.style.borderColor = "#22d3ee";
              e.currentTarget.style.transform = "translateX(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(15, 23, 42, 0.8)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
              e.currentTarget.style.transform = "translateX(0)";
            }}
          >
            <span style={{ fontSize: "16px" }}>←</span>
            <span>Back to Home</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontSize: "13px",
                color: "#22d3ee",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 10px #22c55e",
                }}
              />
              Community Chat
            </span>
          </div>
        </nav>
      ) : (
        <nav className="navbar">
          <button
            className="brand"
            onClick={goHome}
          >
            <span className="brand-mark">
              S
            </span>

            <span className="brand-text">
              <strong>SRM</strong>
              <small>
                Note Finder
              </small>
            </span>
          </button>

          <div className="nav-links">
          <button
            className={navButton(
              page === "home"
            )}
            onClick={goHome}
          >
            Home
          </button>

          <button
            className={navButton(
              page === "community"
            )}
            onClick={() => setPage("community")}
          >
            💬 Community
          </button>

          <button
            className={navButton(
              page === "search"
            )}
            onClick={openSearch}
          >
            Search
          </button>

          <button
            className={navButton(
              page === "gpa"
            )}
            onClick={openGpa}
          >
            GPA+
          </button>

          <button
            className="nav-button"
            onClick={() =>
              setCustomizerOpen(
                (previous) =>
                  !previous
              )
            }
          >
            ✨ Appearance
          </button>

          {studentEmail ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <button
                className="nav-button"
                onClick={() => setShowPrivateMessages(true)}
                title="Private Messages with Admin"
                style={{
                  background: "rgba(56, 189, 248, 0.12)",
                  color: "#38bdf8",
                  borderColor: "rgba(56, 189, 248, 0.3)",
                }}
              >
                ✉️ Messages
              </button>
              <button
                className="nav-button"
                onClick={() => {
                  if (window.confirm("Do you want to sign out from your student account?")) {
                    localStorage.removeItem("srm-student-token");
                    localStorage.removeItem("srm-student-email");
                    setStudentToken("");
                    setStudentEmail("");
                  }
                }}
                title={`Signed in as ${studentEmail}`}
                style={{
                  color: "#e2e8f0",
                  maxWidth: "150px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                👤 {studentEmail.split("@")[0]}
              </button>
            </div>
          ) : (
            <button
              className="nav-button"
              onClick={() => setShowStudentAuth(true)}
              style={{
                background: "linear-gradient(110deg, rgba(34, 211, 238, 0.15), rgba(167, 139, 250, 0.15))",
                borderColor: "rgba(34, 211, 238, 0.35)",
                color: "#f8fafc",
              }}
            >
              Sign In
            </button>
          )}

            {adminLoggedIn && (
              <button
                className={navButton(
                  page === "admin"
                )}
                onClick={openAdmin}
              >
                Admin
              </button>
            )}
          </div>
        </nav>
      )}

      {/* =====================================================
          APPEARANCE
      ===================================================== */}

      {customizerOpen && page !== "community" && (
        <div className="customizer">
          <div className="customizer-title">
            Appearance
          </div>

          <div className="customizer-row">
            <span>Accent Theme</span>

            <div className="accent-options">
              {[
                { id: "aurora-cyan", color: "#22d3ee", label: "Aurora Cyan" },
                { id: "royal-purple", color: "#a78bfa", label: "Royal Purple" },
                { id: "deep-ocean", color: "#38bdf8", label: "Deep Ocean" },
                { id: "emerald", color: "#34d399", label: "Emerald" },
              ].map((item) => (
                <button
                  key={item.id}
                  className={`accent-dot ${
                    theme === item.id ? "selected" : ""
                  }`}
                  style={{
                    backgroundColor: item.color,
                    boxShadow: theme === item.id ? `0 0 10px ${item.color}` : "none",
                  }}
                  onClick={() => setTheme(item.id)}
                  title={item.label}
                />
              ))}
            </div>
          </div>

          <div className="customizer-row">
            <span>Background</span>

            <select
              value={background}
              onChange={(e) => setBackground(e.target.value)}
            >
              <option value="aurora">Aurora</option>
              <option value="moving-gradient">Moving Gradient</option>
              <option value="deep-dark">Deep Dark</option>
            </select>
          </div>

          <div className="customizer-row">
            <span>Glow Intensity</span>

            <select
              value={glowIntensity}
              onChange={(e) => setGlowIntensity(e.target.value)}
            >
              <option value="low">Low (Subtle)</option>
              <option value="medium">Medium (Balanced)</option>
              <option value="high">High (Vibrant)</option>
            </select>
          </div>
        </div>
      )}

      {/* =====================================================
          PAGE
      ===================================================== */}

      <div className="app-content">
        {page === "home" && (
          <HomePage />
        )}

        {page === "semester" && (
          <SemesterPage />
        )}

        {page === "subject" && (
          <SubjectPage />
        )}

        {page === "search" && (
          <SearchPage />
        )}

        {page === "gpa" && (
          <GpaPage />
        )}

        {page === "community" && (
          <main className="main">
            <CommunityChat
              studentEmail={studentEmail}
              onStudentLogin={() => setShowStudentAuth(true)}
              onOpenPrivateMessages={() => setShowPrivateMessages(true)}
            />
          </main>
        )}

        {page === "admin-login" && (
          <AdminLoginPage />
        )}

        {page === "admin" && (
          <AdminDashboard />
        )}
      </div>

      {/* =====================================================
          STUDENT NOTIFICATIONS & OVERLAYS
      ===================================================== */}

      <StudentNotifications />

      {showStudentAuth && (
        <StudentAuth
          onLogin={(data) => {
            if (data?.token) {
              setStudentToken(data.token);
              localStorage.setItem("srm-student-token", data.token);
            }
            if (data?.user?.email) {
              setStudentEmail(data.user.email);
              localStorage.setItem("srm-student-email", data.user.email);
            }
            setShowStudentAuth(false);
          }}
          onClose={() => setShowStudentAuth(false)}
        />
      )}

      {showPrivateMessages && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 7, 12, 0.75)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 2000,
            display: "grid",
            placeItems: "center",
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPrivateMessages(false);
            }
          }}
        >
          <div
            style={{
              width: "min(520px, 94vw)",
              maxHeight: "86vh",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowPrivateMessages(false)}
              aria-label="Close private messages"
              style={{
                position: "absolute",
                top: "14px",
                right: "14px",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#94a3b8",
                width: "32px",
                height: "32px",
                borderRadius: "10px",
                cursor: "pointer",
                zIndex: 10,
                display: "grid",
                placeItems: "center",
                fontSize: "16px",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#94a3b8";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
              }}
            >
              ✕
            </button>
            <StudentPrivateMessages
              studentToken={studentToken}
              studentEmail={studentEmail}
            />
          </div>
        </div>
      )}

      {/* =====================================================
          ADMIN NOTICE
      ===================================================== */}

      {adminNotice && (
        <div
          className={`admin-notice ${adminNotice.type}`}
        >
          <span>
            {adminNotice.type ===
            "error"
              ? "⚠️"
              : "✓"}
          </span>

          <span>
            {adminNotice.message}
          </span>
        </div>
      )}

      {/* =====================================================
          DELETE MODAL
      ===================================================== */}

      {deleteResource && (
        <DeleteModal
          resource={deleteResource}
          onCancel={() =>
            setDeleteResource(null)
          }
          onConfirm={
            confirmDeleteResource
          }
        />
      )}

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="footer">
        <div>
          <strong>
            SRM Note Finder
          </strong>

          <span>
            Student Resource Hub
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>Contact:</span>
          <a
            href="mailto:srmnotefinder@gmail.com"
            style={{
              color: "var(--accent-primary)",
              textDecoration: "none",
              fontWeight: "600",
              transition: "opacity 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            srmnotefinder@gmail.com
          </a>
        </div>

        <div>
          <span>
            ©{" "}
            {new Date().getFullYear()}{" "}
            SRM Note Finder
          </span>
        </div>
      </footer>
    </div>
  );
}