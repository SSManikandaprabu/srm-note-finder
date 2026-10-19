import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import PrivateMessagesPage from "./PrivateMessagesPage";
import NotificationCenter from "./NotificationCenter";
import LiveUsersPage from "./LiveUsersPage";
import AnalyticsPage from "./AnalyticsPage";

const API_BASE =
  (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

export default function Dashboard({ username, onLogout }) {
  const [activePage, setActivePage] = useState("Overview");
  const [resources, setResources] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState("");
  const [bulkUploading, setBulkUploading] = useState(false);
  const [checkingLinks, setCheckingLinks] = useState(false);
  const [linkCheckStats, setLinkCheckStats] = useState(null);
  const [search, setSearch] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);

  const [form, setForm] = useState({
    title: "",
    subject: "",
    semester: "",
    unit1: "",
    unit2: "",
    unit3: "",
    unit4: "",
    unit5: "",
    pyq: "",
    ppt: "",
  });

  const token = localStorage.getItem("srm-admin-token");

  const authHeaders = {
    headers: {
      Authorization: "Bearer " + token,
    },
  };

  const adminName =
    username ||
    localStorage.getItem("srm-admin-username") ||
    "admin";

  useEffect(() => {
    loadDashboardData();
    checkUnreadMessages();
    const unreadInterval = setInterval(checkUnreadMessages, 10000); // Poll unread messages every 10s
    return () => clearInterval(unreadInterval);
  }, []);

  async function checkUnreadMessages() {
    try {
      const token = localStorage.getItem("srm-admin-token");
      if (!token) return;
      const res = await axios.get(`${API_BASE}/api/private-chat/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        setUnreadMessages(res.data.unreadCount || 0);
      }
    } catch {
      // Ignore background unread check errors
    }
  }

  async function loadDashboardData() {
    setLoading(true);

    try {
      const resourcesResponse = await axios.get(
        API_BASE + "/api/resources"
      );

      const subjectsResponse = await axios.get(
        API_BASE + "/api/subjects"
      );

      const resourceData = Array.isArray(
        resourcesResponse.data
      )
        ? resourcesResponse.data
        : resourcesResponse.data?.resources || [];

      const subjectData = Array.isArray(
        subjectsResponse.data
      )
        ? subjectsResponse.data
        : subjectsResponse.data?.subjects || [];

      setResources(resourceData);
      setSubjects(subjectData);
    } catch (error) {
      console.error("Dashboard loading error:", error);

      if (
        error.response?.status === 401 ||
        error.response?.status === 403
      ) {
        alert("Your admin session has expired.");
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("srm-admin-token");
    localStorage.removeItem("srm-admin-username");

    if (onLogout) {
      onLogout();
    }
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm({
      title: "",
      subject: "",
      semester: "",
      unit1: "",
      unit2: "",
      unit3: "",
      unit4: "",
      unit5: "",
      pyq: "",
      ppt: "",
    });
  }

  async function handleAddResource(event) {
    event.preventDefault();

    if (!form.subject.trim()) {
      alert("Please enter the subject.");
      return;
    }

    if (!form.semester) {
      alert("Please select a semester.");
      return;
    }

    const hasLink =
      form.unit1.trim() ||
      form.unit2.trim() ||
      form.unit3.trim() ||
      form.unit4.trim() ||
      form.unit5.trim() ||
      form.pyq.trim() ||
      form.ppt.trim();

    if (!hasLink) {
      alert("Please add at least one Unit, PPT, or PYQ link.");
      return;
    }

    try {
      await axios.post(
        API_BASE + "/api/resources",
        {
          title:
            form.title.trim() ||
            form.subject + " Resources",

          subject: form.subject.trim(),

          semester: Number(form.semester),

          unit1: form.unit1.trim(),
          unit2: form.unit2.trim(),
          unit3: form.unit3.trim(),
          unit4: form.unit4.trim(),
          unit5: form.unit5.trim(),

          pyq: form.pyq.trim(),
          ppt: form.ppt.trim(),
        },
        authHeaders
      );

      alert("Resource added successfully.");

      resetForm();
      setShowResourceForm(false);

      await loadDashboardData();
    } catch (error) {
      console.error("Add resource error:", error);

      if (
        error.response?.status === 401 ||
        error.response?.status === 403
      ) {
        alert("Admin authorization failed.");
        handleLogout();
        return;
      }

      alert(
        error.response?.data?.message ||
          "Unable to add resource."
      );
    }
  }

  async function handleDeleteResource(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this resource?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await axios.delete(
        API_BASE + "/api/resources/" + id,
        authHeaders
      );

      alert("Resource deleted successfully.");

      await loadDashboardData();
    } catch (error) {
      console.error("Delete error:", error);

      alert(
        error.response?.data?.message ||
          "Unable to delete resource."
      );
    }
  }

  // Parse CSV text into array of objects
  function parseCsvString(csvText) {
    const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    // Simple CSV parser supporting quotes
    function parseLine(line) {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    }

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_]+/g, ""));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || "";
      });
      rows.push(obj);
    }
    return rows;
  }

  function handleCsvFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setBulkCsvText(event.target.result || "");
    };
    reader.readAsText(file);
  }

  async function handleBulkUpload() {
    if (!bulkCsvText.trim()) {
      alert("Please paste CSV data or choose a .csv file.");
      return;
    }

    const parsedItems = parseCsvString(bulkCsvText);
    if (parsedItems.length === 0) {
      alert("Could not parse any rows from the CSV. Please check format: Title,Subject,Semester,Type,DriveUrl");
      return;
    }

    setBulkUploading(true);
    try {
      const res = await axios.post(
        `${API_BASE}/api/resources/bulk`,
        { items: parsedItems },
        authHeaders
      );

      if (res.data?.success) {
        alert(res.data.message || `Successfully imported ${res.data.importedCount} resources!`);
        setShowBulkModal(false);
        setBulkCsvText("");
        await loadDashboardData();
      }
    } catch (err) {
      console.error("Bulk upload error:", err);
      alert(err.response?.data?.message || "Bulk import failed. Please check your data.");
    } finally {
      setBulkUploading(false);
    }
  }

  async function handleCheckLinkHealth() {
    setCheckingLinks(true);
    try {
      const res = await axios.post(
        `${API_BASE}/api/resources/check-links`,
        {},
        authHeaders
      );
      if (res.data?.success) {
        setLinkCheckStats({
          checked: res.data.checkedCount,
          working: res.data.workingCount,
          broken: res.data.brokenCount,
        });
        alert(res.data.message);
        await loadDashboardData();
      }
    } catch (err) {
      console.error("Link check error:", err);
      alert(err.response?.data?.message || "Failed to check links.");
    } finally {
      setCheckingLinks(false);
    }
  }

  const filteredResources = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) {
      return resources;
    }

    return resources.filter((resource) => {
      return (
        String(resource.title || "")
          .toLowerCase()
          .includes(query) ||
        String(resource.subject || "")
          .toLowerCase()
          .includes(query) ||
        String(resource.semester || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [resources, search]);

  const totalResources = resources.length;
  const totalSubjects = subjects.length;
  const totalSemesters = 8;

  function ResourceForm() {
    return (
      <div className="resource-modal-overlay">
        <div className="resource-modal">

          <div className="resource-modal-header">
            <div>
              <span className="panel-kicker">
                CONTENT MANAGEMENT
              </span>

              <h2>Add Resource</h2>

              <p>
                Add Units 1–5 and PYQ links for a subject.
              </p>
            </div>

            <button
              className="modal-close"
              type="button"
              onClick={() => {
                setShowResourceForm(false);
                resetForm();
              }}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleAddResource}>

            <div className="form-grid">

              <div className="admin-field">
                <label>Resource Title</label>

                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleFormChange}
                  placeholder="Example: Data Structures Notes"
                />
              </div>

              <div className="admin-field">
                <label>Semester</label>

                <select
                  name="semester"
                  value={form.semester}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">
                    Select Semester
                  </option>

                  {[1, 2, 3, 4, 5, 6, 7, 8].map(
                    (semester) => (
                      <option
                        key={semester}
                        value={semester}
                      >
                        Semester {semester}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="admin-field full-field">
                <label>Subject</label>

                <input
                  type="text"
                  name="subject"
                  value={form.subject}
                  onChange={handleFormChange}
                  placeholder="Example: Data Structures And Algorithm"
                  required
                />
              </div>

              <div className="admin-field">
                <label>Unit 1 Link</label>

                <input
                  type="url"
                  name="unit1"
                  value={form.unit1}
                  onChange={handleFormChange}
                  placeholder="https://..."
                />
              </div>

              <div className="admin-field">
                <label>Unit 2 Link</label>

                <input
                  type="url"
                  name="unit2"
                  value={form.unit2}
                  onChange={handleFormChange}
                  placeholder="https://..."
                />
              </div>

              <div className="admin-field">
                <label>Unit 3 Link</label>

                <input
                  type="url"
                  name="unit3"
                  value={form.unit3}
                  onChange={handleFormChange}
                  placeholder="https://..."
                />
              </div>

              <div className="admin-field">
                <label>Unit 4 Link</label>

                <input
                  type="url"
                  name="unit4"
                  value={form.unit4}
                  onChange={handleFormChange}
                  placeholder="https://..."
                />
              </div>

              <div className="admin-field">
                <label>Unit 5 Link</label>

                <input
                  type="url"
                  name="unit5"
                  value={form.unit5}
                  onChange={handleFormChange}
                  placeholder="https://..."
                />
              </div>

              <div className="admin-field">
                <label>PYQ / Question Papers Link</label>

                <input
                  type="url"
                  name="pyq"
                  value={form.pyq}
                  onChange={handleFormChange}
                  placeholder="Paste PYQ / CT links (one per line or Google Drive link)"
                />
              </div>

              <div className="admin-field">
                <label>Presentation / PPT Link</label>

                <input
                  type="url"
                  name="ppt"
                  value={form.ppt}
                  onChange={handleFormChange}
                  placeholder="https://drive.google.com/... (PPTs / Slides)"
                />
              </div>

            </div>

            <div className="resource-form-actions">

              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  setShowResourceForm(false);
                  resetForm();
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="save-resource-button"
              >
                + Add Resource
              </button>

            </div>

          </form>
        </div>
      </div>
    );
  }

  function OverviewPage() {
    return (
      <>
        <section className="dashboard-hero">

          <div className="hero-content">

            <div className="hero-badge">
              <span>✦</span>
              SRM NOTE FINDER
            </div>

            <h2>
              Welcome back,
              <br />
              <span>{adminName}.</span>
            </h2>

            <p>
              Manage your academic resources, subjects,
              study materials and important links from
              one powerful control center.
            </p>

            <div className="hero-actions">

              <button
                className="primary-action"
                onClick={() =>
                  setShowResourceForm(true)
                }
              >
                <span>+</span>
                Add Resource
              </button>

              <button
                className="secondary-action"
                onClick={() =>
                  setActivePage("Resources")
                }
              >
                View Resources
                <span>→</span>
              </button>

            </div>

          </div>

          <div className="hero-visual">

            <div className="visual-glow"></div>

            <div className="visual-orbit orbit-one"></div>
            <div className="visual-orbit orbit-two"></div>
            <div className="visual-orbit orbit-three"></div>

            <div className="visual-core">
              <span>SRM</span>
              <small>NOTES</small>
            </div>

            <div className="floating-card floating-card-one">
              <span>📚</span>
              <strong>Resources</strong>
            </div>

            <div className="floating-card floating-card-two">
              <span>✓</span>
              <strong>Secure</strong>
            </div>

          </div>

        </section>

        <section className="dashboard-stats">

          <div className="stat-card">

            <div className="stat-icon purple">
              ◈
            </div>

            <div className="stat-info">
              <span>Total Resources</span>
              <strong>{totalResources}</strong>
              <small>Study materials</small>
            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon blue">
              ◫
            </div>

            <div className="stat-info">
              <span>Subjects</span>
              <strong>{totalSubjects}</strong>
              <small>Across semesters</small>
            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon cyan">
              ◉
            </div>

            <div className="stat-info">
              <span>Semesters</span>
              <strong>{totalSemesters}</strong>
              <small>Academic semesters</small>
            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon green">
              ✓
            </div>

            <div className="stat-info">
              <span>System Status</span>
              <strong>Online</strong>
              <small>Backend connected</small>
            </div>

            <div className="stat-live">
              LIVE
            </div>

          </div>

        </section>

        <section className="dashboard-content-grid">

          <div className="dashboard-panel">

            <div className="panel-header">

              <div>
                <span className="panel-kicker">
                  MANAGEMENT
                </span>

                <h3>Quick Actions</h3>
              </div>

            </div>

            <div className="quick-actions">

              <button
                className="quick-action purple-action"
                onClick={() =>
                  setShowResourceForm(true)
                }
              >
                <div className="quick-icon">
                  +
                </div>

                <div className="quick-text">
                  <strong>Add Resource</strong>
                  <span>
                    Upload notes, units and PYQs
                  </span>
                </div>

                <b>→</b>
              </button>

              <button
                className="quick-action blue-action"
                onClick={() =>
                  setActivePage("Subjects")
                }
              >
                <div className="quick-icon">
                  ◫
                </div>

                <div className="quick-text">
                  <strong>Manage Subjects</strong>
                  <span>
                    Organize semester subjects
                  </span>
                </div>

                <b>→</b>
              </button>

              <button
                className="quick-action cyan-action"
                onClick={() =>
                  setActivePage("Links")
                }
              >
                <div className="quick-icon">
                  ↗
                </div>

                <div className="quick-text">
                  <strong>Manage Links</strong>
                  <span>
                    Update Unit 1–5 and PYQs
                  </span>
                </div>

                <b>→</b>
              </button>

            </div>

          </div>

          <div className="dashboard-panel">

            <div className="panel-header">

              <div>
                <span className="panel-kicker">
                  SYSTEM
                </span>

                <h3>Portal Status</h3>
              </div>

              <span className="live-badge">
                LIVE
              </span>

            </div>

            <div className="system-status">

              <div className="system-row">
                <div className="system-name">
                  <span className="system-dot"></span>
                  Backend API
                </div>

                <strong>Connected</strong>
              </div>

              <div className="system-row">
                <div className="system-name">
                  <span className="system-dot"></span>
                  Authentication
                </div>

                <strong>Active</strong>
              </div>

              <div className="system-row">
                <div className="system-name">
                  <span className="system-dot"></span>
                  Database
                </div>

                <strong>MongoDB</strong>
              </div>

              <div className="system-row">
                <div className="system-name">
                  <span className="system-dot"></span>
                  Admin Session
                </div>

                <strong>Secure</strong>
              </div>

            </div>

          </div>

        </section>

        <section className="dashboard-panel recent-panel">

          <div className="panel-header">

            <div>
              <span className="panel-kicker">
                CONTENT LIBRARY
              </span>

              <h3>Recent Resources</h3>
            </div>

            <button
              className="view-all-button"
              onClick={() =>
                setActivePage("Resources")
              }
            >
              View All →
            </button>

          </div>

          {resources.length === 0 ? (
            <div className="empty-resources">

              <div className="empty-icon">
                ◈
              </div>

              <h4>No resources yet</h4>

              <p>
                Add your first study resource to start
                building the SRM Note Finder library.
              </p>

              <button
                className="empty-button"
                onClick={() =>
                  setShowResourceForm(true)
                }
              >
                <span>+</span>
                Add First Resource
              </button>

            </div>
          ) : (
            <ResourceTable
              items={resources.slice(0, 5)}
              onDelete={handleDeleteResource}
            />
          )}

        </section>
      </>
    );
  }

  function ResourcesPage() {
    return (
      <section className="dashboard-panel page-panel">

        <div className="panel-header">

          <div>
            <span className="panel-kicker">
              CONTENT MANAGEMENT
            </span>

            <h3>Resources</h3>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              className="primary-action small-action"
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
                borderColor: "rgba(16, 185, 129, 0.4)",
              }}
              onClick={() => setShowBulkModal(true)}
            >
              📑 Bulk Import CSV
            </button>

            <button
              className="primary-action small-action"
              style={{
                background: checkingLinks ? "rgba(255, 255, 255, 0.1)" : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                borderColor: "rgba(59, 130, 246, 0.4)",
                cursor: checkingLinks ? "not-allowed" : "pointer",
              }}
              disabled={checkingLinks}
              onClick={handleCheckLinkHealth}
            >
              {checkingLinks ? "⏳ Checking Links..." : "🔍 Check Link Health"}
            </button>

            <button
              className="primary-action small-action"
              onClick={() =>
                setShowResourceForm(true)
              }
            >
              + Add Resource
            </button>
          </div>
        </div>

        <div className="resource-toolbar">

          <input
            className="resource-search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search resources or subjects..."
          />

          <span>
            {filteredResources.length} resources
          </span>

        </div>

        {loading ? (
          <div className="page-loading">
            Loading resources...
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="empty-resources">

            <div className="empty-icon">
              ◈
            </div>

            <h4>No resources found</h4>

            <p>
              Add a resource or change your search.
            </p>

            <button
              className="empty-button"
              onClick={() =>
                setShowResourceForm(true)
              }
            >
              + Add Resource
            </button>

          </div>
        ) : (
          <ResourceTable
            items={filteredResources}
            onDelete={handleDeleteResource}
          />
        )}

      </section>
    );
  }

  function SubjectsPage() {
    return (
      <section className="dashboard-panel page-panel">

        <div className="panel-header">

          <div>
            <span className="panel-kicker">
              ACADEMIC STRUCTURE
            </span>

            <h3>Subjects</h3>
          </div>

        </div>

        {subjects.length === 0 ? (
          <div className="empty-resources">

            <div className="empty-icon">
              ◫
            </div>

            <h4>No subjects returned</h4>

            <p>
              The backend did not return a subject list.
            </p>

          </div>
        ) : (
          <div className="subject-grid">

            {subjects.map((subject, index) => {

              const name =
                typeof subject === "string"
                  ? subject
                  : subject.name ||
                    subject.subject ||
                    subject.title ||
                    "Subject " + (index + 1);

              return (
                <div
                  className="subject-card"
                  key={index}
                >

                  <div className="subject-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <strong>{name}</strong>

                </div>
              );
            })}

          </div>
        )}

      </section>
    );
  }

  function LinksPage() {
    return (
      <section className="dashboard-panel page-panel">

        <div className="panel-header">

          <div>
            <span className="panel-kicker">
              RESOURCE LINKS
            </span>

            <h3>Unit & PYQ Links</h3>
          </div>

        </div>

        <ResourceTable
          items={resources}
          onDelete={handleDeleteResource}
          showLinks
        />

      </section>
    );
  }

  function SettingsPage() {
    const [siteName, setSiteName] = useState(
      localStorage.getItem("srm-site-name") ||
        "SRM Note Finder"
    );

    const [contactEmail, setContactEmail] = useState(
      localStorage.getItem("srm-contact-email") ||
        "admin@srmnotefinder.com"
    );

    const [maintenance, setMaintenance] = useState(
      localStorage.getItem("srm-maintenance") ===
        "true"
    );

    const [chatEnabled, setChatEnabled] = useState(true);

    const [theme, setTheme] = useState(
      localStorage.getItem("srm-theme") || "aurora-cyan"
    );

    const [backgroundStyle, setBackgroundStyle] = useState(
      localStorage.getItem("srm-bg-style") || "aurora"
    );

    const [glowIntensity, setGlowIntensity] = useState(
      localStorage.getItem("srm-glow-intensity") || "medium"
    );

    const [announcement, setAnnouncement] = useState(
      localStorage.getItem("srm-announcement") || ""
    );

    const [saved, setSaved] = useState(false);

    useEffect(() => {
      // Load current settings from backend
      axios.get(`${API_BASE}/api/settings`).then((res) => {
        if (res.data?.settings) {
          const s = res.data.settings;
          if (s.siteName) setSiteName(s.siteName);
          if (s.contactEmail) setContactEmail(s.contactEmail);
          if (s.maintenanceMode !== undefined) setMaintenance(Boolean(s.maintenanceMode));
          if (s.communityChatEnabled !== undefined) setChatEnabled(Boolean(s.communityChatEnabled));
          if (s.announcement !== undefined) setAnnouncement(s.announcement);
          if (s.theme) setTheme(s.theme);
          if (s.backgroundStyle) setBackgroundStyle(s.backgroundStyle);
          if (s.glowIntensity) setGlowIntensity(s.glowIntensity);
        }
      }).catch((err) => console.error("Error loading server settings:", err));
    }, []);

    const saveGeneralSettings = async () => {
      localStorage.setItem("srm-site-name", siteName);
      localStorage.setItem("srm-contact-email", contactEmail);
      localStorage.setItem("srm-maintenance", String(maintenance));
      localStorage.setItem("srm-announcement", announcement);
      localStorage.setItem("srm-theme", theme);
      localStorage.setItem("srm-bg-style", backgroundStyle);
      localStorage.setItem("srm-glow-intensity", glowIntensity);

      try {
        const token = localStorage.getItem("srm-admin-token");
        await axios.put(
          `${API_BASE}/api/admin/settings`,
          {
            siteName,
            contactEmail,
            maintenanceMode: maintenance,
            communityChatEnabled: chatEnabled,
            announcement,
            theme,
            backgroundStyle,
            glowIntensity,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch (err) {
        console.error("Failed to save settings to server:", err);
      }

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
      }, 2000);
    };

    return (
      <div className="settings-page">

        <div className="settings-heading">

          <div>

            <div className="eyebrow">
              ADMIN CONTROL CENTER
            </div>

            <h2>General Settings</h2>

            <p>
              Manage the basic configuration of
              SRM Note Finder.
            </p>

          </div>

          <div className="settings-status">
            <span></span>
            System Online
          </div>

        </div>

        <div className="general-settings-layout">

          <div className="general-settings-card">

            <div className="general-card-header">

              <div>

                <span className="general-label">
                  WEBSITE
                </span>

                <h3>Website Information</h3>

                <p>
                  Basic information displayed throughout
                  the SRM Note Finder platform.
                </p>

              </div>

              <div className="general-icon">
                ◉
              </div>

            </div>

            <div className="general-form">

              <div className="general-field">

                <label>Website Name</label>

                <input
                  type="text"
                  value={siteName}
                  onChange={(e) =>
                    setSiteName(e.target.value)
                  }
                  placeholder="Enter website name"
                />

              </div>

              <div className="general-field">

                <label>Admin Contact Email</label>

                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) =>
                    setContactEmail(e.target.value)
                  }
                  placeholder="Enter contact email"
                />

              </div>

              <div className="general-field">

                <label>Announcement</label>

                <textarea
                  value={announcement}
                  onChange={(e) =>
                    setAnnouncement(e.target.value)
                  }
                  placeholder="Enter an announcement for administrators..."
                  rows="4"
                />

              </div>

            </div>

          </div>

          <div className="general-settings-card">

            <div className="general-card-header">

              <div>

                <span className="general-label">
                  SYSTEM
                </span>

                <h3>System Controls</h3>

                <p>
                  Control important website-wide behaviour.
                </p>

              </div>

              <div className="general-icon purple">
                ⚙
              </div>

            </div>

            <div className="system-control">

              <div>

                <strong>
                  Maintenance Mode
                </strong>

                <span>
                  Temporarily disable normal website
                  access while maintenance is being
                  performed.
                </span>

              </div>

              <button
                type="button"
                className={
                  maintenance
                    ? "settings-toggle active"
                    : "settings-toggle"
                }
                onClick={() =>
                  setMaintenance(!maintenance)
                }
              >
                <span></span>
              </button>

            </div>

            <div className="system-control">

              <div>

                <strong>
                  Community Chat
                </strong>

                <span>
                  Enable or disable the real-time community chat room for all students.
                </span>

              </div>

              <button
                type="button"
                className={
                  chatEnabled
                    ? "settings-toggle active"
                    : "settings-toggle"
                }
                onClick={() =>
                  setChatEnabled(!chatEnabled)
                }
              >
                <span></span>
              </button>

            </div>

            <div className="system-status-box">

              <div className="system-status-dot"></div>

              <div>

                <strong>
                  {maintenance
                    ? "Maintenance mode enabled"
                    : "Website operating normally"}
                </strong>

                <p>
                  {maintenance
                    ? "Normal website access is currently disabled."
                    : "SRM Note Finder is currently available."}
                </p>

              </div>

            </div>

          </div>

          <div className="general-settings-card">

            <div className="general-card-header">

              <div>

                <span className="general-label">
                  APPEARANCE
                </span>

                <h3>Appearance Settings</h3>

                <p>
                  Customize website theme colors, background motion, and glow intensity.
                </p>

              </div>

              <div className="general-icon" style={{ background: "rgba(34, 211, 238, 0.15)", color: "#22d3ee" }}>
                ✨
              </div>

            </div>

            <div className="general-form">

              <div className="general-field">
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Themes</span>
                  <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "400" }}>Website accent palette</span>
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", marginTop: "8px" }}>
                  {[
                    { id: "aurora-cyan", label: "Aurora Cyan", desc: "Cyan accents with an aurora-inspired premium look.", color: "#22d3ee" },
                    { id: "royal-purple", label: "Royal Purple", desc: "Purple accents with a modern, elegant appearance.", color: "#a78bfa" },
                    { id: "deep-ocean", label: "Deep Ocean", desc: "Deep blue tones for a sleek interface.", color: "#38bdf8" },
                    { id: "emerald", label: "Emerald", desc: "Green accents for a fresh, clean style.", color: "#34d399" },
                  ].map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "14px",
                        border: theme === t.id ? `2px solid ${t.color}` : "1px solid rgba(255, 255, 255, 0.1)",
                        background: theme === t.id ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.6)",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: t.color, display: "inline-block", boxShadow: `0 0 8px ${t.color}` }}></span>
                        <strong style={{ color: "#f8fafc", fontSize: "13px" }}>{t.label}</strong>
                        {theme === t.id && <span style={{ marginLeft: "auto", color: t.color, fontSize: "12px" }}>✓</span>}
                      </div>
                      <p style={{ color: "#94a3b8", fontSize: "11px", margin: 0, lineHeight: "1.4" }}>{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="general-field" style={{ marginTop: "14px" }}>
                <label>Background styles</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginTop: "8px" }}>
                  {[
                    { id: "aurora", label: "Aurora", desc: "The default aurora-style background." },
                    { id: "moving-gradient", label: "Moving Gradient", desc: "A gradient background with motion." },
                    { id: "deep-dark", label: "Deep Dark", desc: "A dark background with a minimal, premium feel." },
                  ].map((bg) => (
                    <div
                      key={bg.id}
                      onClick={() => setBackgroundStyle(bg.id)}
                      style={{
                        padding: "12px",
                        borderRadius: "14px",
                        border: backgroundStyle === bg.id ? "2px solid #22d3ee" : "1px solid rgba(255, 255, 255, 0.1)",
                        background: backgroundStyle === bg.id ? "rgba(34, 211, 238, 0.08)" : "rgba(15, 23, 42, 0.6)",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <strong style={{ color: "#f8fafc", fontSize: "13px", display: "block", marginBottom: "4px" }}>
                        {bg.label} {backgroundStyle === bg.id && <span style={{ color: "#22d3ee" }}>✓</span>}
                      </strong>
                      <span style={{ color: "#94a3b8", fontSize: "11px", lineHeight: "1.4", display: "block" }}>{bg.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="general-field" style={{ marginTop: "14px" }}>
                <label>Glow intensity</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginTop: "8px" }}>
                  {[
                    { id: "low", label: "Low", desc: "Subtle glow effects." },
                    { id: "medium", label: "Medium", desc: "Balanced glow effects." },
                    { id: "high", label: "High", desc: "Stronger, more vibrant glow effects." },
                  ].map((glow) => (
                    <div
                      key={glow.id}
                      onClick={() => setGlowIntensity(glow.id)}
                      style={{
                        padding: "12px",
                        borderRadius: "14px",
                        border: glowIntensity === glow.id ? "2px solid #a78bfa" : "1px solid rgba(255, 255, 255, 0.1)",
                        background: glowIntensity === glow.id ? "rgba(167, 139, 250, 0.08)" : "rgba(15, 23, 42, 0.6)",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <strong style={{ color: "#f8fafc", fontSize: "13px", display: "block", marginBottom: "4px" }}>
                        {glow.label} {glowIntensity === glow.id && <span style={{ color: "#a78bfa" }}>✓</span>}
                      </strong>
                      <span style={{ color: "#94a3b8", fontSize: "11px", lineHeight: "1.4", display: "block" }}>{glow.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

        </div>

        <div className="general-save-bar">

          <div>

            {saved ? (
              <>
                <span className="save-success-dot"></span>
                Settings saved successfully
              </>
            ) : (
              "Changes are stored locally for now."
            )}

          </div>

          <button
            type="button"
            className="general-save-button"
            onClick={saveGeneralSettings}
          >
            {saved
              ? "Saved ✓"
              : "Save Changes"}
          </button>

        </div>

      </div>
    );
  }

  function ResourceTable({
    items,
    onDelete,
    showLinks = false,
  }) {
    return (
      <div className="resource-table-wrapper">

        <table className="resource-table">

          <thead>
            <tr>
              <th>Resource</th>
              <th>Subject</th>
              <th>Semester</th>

              {showLinks && (
                <th>Links</th>
              )}

              <th>Actions</th>
            </tr>
          </thead>

          <tbody>

            {items.map((resource) => {

              const id =
                resource._id ||
                resource.id;

              return (
                <tr key={id}>

                  <td>

                    <div className="resource-title">

                      <div className="resource-mini-icon">
                        ◈
                      </div>

                      <div>

                        <strong>
                          {resource.title ||
                            "Untitled Resource"}
                        </strong>

                        <span>
                          Academic Resource
                        </span>

                      </div>

                    </div>

                  </td>

                  <td>
                    {resource.subject || "—"}
                  </td>

                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="semester-badge">
                        Sem {resource.semester || "—"}
                      </span>
                      {resource.linkStatus === "working" && (
                        <span style={{ fontSize: "11px", color: "#10b981", background: "rgba(16, 185, 129, 0.15)", padding: "2px 6px", borderRadius: "4px", fontWeight: "600" }} title="Link healthy">
                          ✓ Active
                        </span>
                      )}
                      {resource.linkStatus === "broken" && (
                        <span style={{ fontSize: "11px", color: "#ef4444", background: "rgba(239, 68, 68, 0.15)", padding: "2px 6px", borderRadius: "4px", fontWeight: "700" }} title="Link broken / not found">
                          ⚠ Broken
                        </span>
                      )}
                      {resource.linkStatus === "restricted" && (
                        <span style={{ fontSize: "11px", color: "#f59e0b", background: "rgba(245, 158, 11, 0.15)", padding: "2px 6px", borderRadius: "4px", fontWeight: "600" }} title="Permission required / restricted">
                          🔒 Restricted
                        </span>
                      )}
                    </div>
                  </td>

                  {showLinks && (
                    <td>

                      <div className="link-count">

                        {[
                          resource.unit1,
                          resource.unit2,
                          resource.unit3,
                          resource.unit4,
                          resource.unit5,
                          resource.pyq,
                        ].filter(Boolean).length}{" "}
                        links

                      </div>

                    </td>
                  )}

                  <td>

                    <button
                      className="delete-resource-button"
                      onClick={() =>
                        onDelete(id)
                      }
                    >
                      Delete
                    </button>

                  </td>

                </tr>
              );
            })}

          </tbody>

        </table>

      </div>
    );
  }

  function renderPage() {
    if (activePage === "Resources") {
      return <ResourcesPage />;
    }

    if (activePage === "Subjects") {
      return <SubjectsPage />;
    }

    if (activePage === "Links") {
      return <LinksPage />;
    }

    if (activePage === "Live Users") {
      return <LiveUsersPage />;
    }

    if (activePage === "Analytics") {
      return <AnalyticsPage />;
    }

    if (activePage === "Private Messages") {
      return <PrivateMessagesPage />;
    }

    if (activePage === "Notifications") {
      return <NotificationCenter />;
    }

    if (activePage === "Settings") {
      return <SettingsPage />;
    }

    return <OverviewPage />;
  }

  return (
    <div className="dashboard">

      <aside className="dashboard-sidebar">

        <div className="sidebar-brand">

          <div className="brand-logo">
            S
          </div>

          <div className="brand-text">
            <h2>SRM Notes</h2>
            <span>ADMIN PORTAL</span>
          </div>

        </div>

        <div className="sidebar-menu-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingRight: "4px" }}>
        <div className="sidebar-section-title">
          MAIN MENU
        </div>

        <nav className="sidebar-nav">

          <button
            className={`sidebar-item ${
              activePage === "Overview"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("Overview")
            }
          >
            <span className="sidebar-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </span>

            <span>Overview</span>
          </button>

          <button
            className={`sidebar-item ${
              activePage === "Resources"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("Resources")
            }
          >
            <span className="sidebar-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                <path d="M6 6h10"/>
                <path d="M6 10h10"/>
              </svg>
            </span>

            <span>Resources</span>
          </button>

          <button
            className={`sidebar-item ${
              activePage === "Subjects"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("Subjects")
            }
          >
            <span className="sidebar-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="7" x="3" y="3" rx="1"/>
                <rect width="7" height="7" x="14" y="3" rx="1"/>
                <rect width="7" height="7" x="14" y="14" rx="1"/>
                <rect width="7" height="7" x="3" y="14" rx="1"/>
              </svg>
            </span>

            <span>Subjects</span>
          </button>

          <button
            className={`sidebar-item ${
              activePage === "Links"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("Links")
            }
          >
            <span className="sidebar-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </span>

            <span>Links</span>
          </button>

          <button
            className={`sidebar-item ${
              activePage === "Live Users"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("Live Users")
            }
          >
            <span className="sidebar-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </span>

            <span>Live Users</span>
          </button>

          <button
            className={`sidebar-item ${
              activePage === "Analytics"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("Analytics")
            }
          >
            <span className="sidebar-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </span>

            <span>Analytics</span>
          </button>

        </nav>

        <div className="sidebar-section-title">
          SYSTEM
        </div>

        <nav className="sidebar-nav">

          <button
            className={`sidebar-item ${
              activePage === "Private Messages" ? "active" : ""
            }`}
            onClick={() => {
              setActivePage("Private Messages");
              setUnreadMessages(0);
            }}
            style={{ position: "relative" }}
          >
            <span className="sidebar-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </span>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <span>Private Messages</span>
              {unreadMessages > 0 && (
                <span
                  style={{
                    background: "linear-gradient(135deg, #ef4444, #dc2626)",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: "800",
                    padding: "2px 7px",
                    borderRadius: "999px",
                    boxShadow: "0 0 12px rgba(239, 68, 68, 0.6)",
                    lineHeight: "1.2",
                    animation: "pulse 2s infinite",
                  }}
                >
                  {unreadMessages}
                </span>
              )}
            </span>
          </button>

          <button
            className={`sidebar-item ${
              activePage === "Notifications" ? "active" : ""
            }`}
            onClick={() => setActivePage("Notifications")}
          >
            <span className="sidebar-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </span>
            <span>Notifications</span>
          </button>

          <button
            className={`sidebar-item ${
              activePage === "Settings"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActivePage("Settings")
            }
          >
            <span className="sidebar-icon">
              ⚙
            </span>

            <span>Settings</span>
          </button>

        </nav>
        </div>

        <div className="sidebar-bottom" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "14px" }}>

          <details className="admin-menu" style={{ position: "relative" }}>

            <summary
              className="admin-mini"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 12px",
                borderRadius: "14px",
                background: "rgba(255, 255, 255, 0.035)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                cursor: "pointer",
                listStyle: "none",
                transition: "all 0.2s ease",
              }}
            >
              <div
                className="admin-avatar"
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                  display: "grid",
                  placeItems: "center",
                  color: "#fff",
                  fontWeight: "800",
                  fontSize: "14px",
                  boxShadow: "0 0 16px rgba(6, 182, 212, 0.35)",
                  flexShrink: 0,
                }}
              >
                {adminName.charAt(0).toUpperCase()}
              </div>

              <div className="admin-info" style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                <strong style={{ color: "#f8fafc", fontSize: "13px", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {adminName}
                </strong>
                <span style={{ color: "#22d3ee", fontSize: "11px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", display: "inline-block" }}></span>
                  Administrator
                </span>
              </div>

              <span className="admin-menu-arrow" style={{ color: "#94a3b8", fontSize: "12px", transition: "transform 0.2s ease" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </span>
            </summary>

            <div style={{ marginTop: "8px", padding: "4px" }}>
              <button
                type="button"
                className="sidebar-logout"
                onClick={handleLogout}
                style={{
                  width: "100%",
                  height: "42px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  borderRadius: "12px",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  background: "rgba(239, 68, 68, 0.08)",
                  color: "#f87171",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.18)";
                  e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
                  e.currentTarget.style.color = "#fca5a5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
                  e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.25)";
                  e.currentTarget.style.color = "#f87171";
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" x2="9" y1="12" y2="12"/>
                </svg>
                <span>Logout</span>
              </button>
            </div>

          </details>

        </div>

      </aside>

      <main className="dashboard-main">

        <header className="dashboard-topbar">

          <div className="topbar-left">

            <div className="topbar-mobile-logo">
              S
            </div>

            <div>

              <p className="topbar-label">
                ADMIN CONTROL CENTER
              </p>

              <h1>
                {activePage}
              </h1>

            </div>

          </div>

          <div className="topbar-right">

            <div className="status-pill">

              <span className="status-dot"></span>

              System Online

            </div>

            <div className="topbar-avatar">
              {adminName
                .charAt(0)
                .toUpperCase()}
            </div>

          </div>

        </header>

        {renderPage()}

        <footer className="dashboard-footer">

          <span>
            © 2026 SRM Note Finder
          </span>

          <span>
            Secure Admin Management System
          </span>

        </footer>

      </main>

      {showResourceForm && (
        <ResourceForm />
      )}

      {showBulkModal && (
        <div
          className="modal-backdrop"
          onClick={() => !bulkUploading && setShowBulkModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f172a",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "16px",
              padding: "28px",
              width: "100%",
              maxWidth: "680px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
              color: "#f8fafc",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
              <div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "20px", fontWeight: "700" }}>
                  📑 Bulk Resource Upload (CSV)
                </h3>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px" }}>
                  Upload a CSV file or paste formatted CSV rows below to import dozens of notes simultaneously.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                disabled={bulkUploading}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "20px",
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "12px", color: "#93c5fd" }}>
              <strong>Expected CSV Header Format:</strong><br />
              <code style={{ background: "rgba(0, 0, 0, 0.3)", padding: "2px 6px", borderRadius: "4px", display: "inline-block", marginTop: "4px" }}>
                Title,Subject,Semester,Type,DriveUrl
              </code>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                Select .CSV File from Device:
              </label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileSelect}
                disabled={bulkUploading}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px",
                  background: "#1e293b",
                  border: "1px dashed rgba(255, 255, 255, 0.2)",
                  borderRadius: "8px",
                  color: "#cbd5e1",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px", color: "#cbd5e1" }}>
                Or Paste CSV Content Here:
              </label>
              <textarea
                value={bulkCsvText}
                onChange={(e) => setBulkCsvText(e.target.value)}
                placeholder="Title,Subject,Semester,Type,DriveUrl&#10;Unit 1 Calculus Notes,Calculus And Linear Algebra,1,Notes,https://drive.google.com/file/d/example1&#10;OS Unit 2 Guide,Operating Systems,3,Notes,https://drive.google.com/file/d/example2"
                rows={8}
                disabled={bulkUploading}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#1e293b",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "8px",
                  color: "#f8fafc",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                disabled={bulkUploading}
                style={{
                  padding: "9px 18px",
                  background: "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "8px",
                  color: "#cbd5e1",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleBulkUpload}
                disabled={bulkUploading}
                style={{
                  padding: "9px 20px",
                  background: bulkUploading ? "rgba(16, 185, 129, 0.5)" : "linear-gradient(135deg, #10b981, #059669)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: bulkUploading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                }}
              >
                {bulkUploading ? "Uploading..." : "Import Resources"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}