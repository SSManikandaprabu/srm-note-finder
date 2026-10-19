const http = require("http");
const { Server } = require("socket.io");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const Settings = require("./models/Settings");
const Notification = require("./models/Notification");
const ChatMessage = require("./models/ChatMessage");
const StudentAuth = require("./models/StudentAuth");
const AuditLog = require("./models/AuditLog");
const studentAuthRoutes = require("./routes/studentAuth");
const privateChatRoutes = require("./routes/privateChat");
const aiAssistantRoutes = require("./routes/aiAssistant");
const { analyzeAbuse, checkSpam, DEFAULT_ABUSIVE_WORDS } = require("./utils/moderation");
const { uploadPdf, verifyPdfMagicBytes, MAX_FILE_SIZE } = require("./middleware/upload");

const app = express();
const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ===============================
// SECURITY HEADERS & MIDDLEWARE
// ===============================

// Secure HTTP headers with CSP configured to allow local and CDN scripts/fonts
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Keep flexible for dev and custom CDN assets
  })
);

app.use(cors());
app.use(express.json({ limit: "1mb" })); // Prevent oversized JSON payload DoS

// Middleware to ensure Mongoose is connected for serverless environments
let isConnected = false;
async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  if (!process.env.MONGODB_URI) {
    return;
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false,
    });
    isConnected = true;
  } catch (err) {
    console.error("MongoDB serverless connection error:", err.message);
  }
}

app.use(async (req, res, next) => {
  await connectToDatabase();
  next();
});

app.set("trust proxy", 1); // Crucial for Vercel / reverse proxies

// Rate limiter for admin login (10 attempts per 15 minutes)
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Prevent express-rate-limit 7+ from throwing ERR_ERL_FORWARDED_HEADER behind proxies
  message: { success: false, message: "Too many login attempts. Please try again after 15 minutes." },
});

// Secure PDF downloads/viewing route
app.use(
  "/uploads/notes",
  express.static(path.join(__dirname, "uploads", "notes"), {
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", "inline");
    },
  })
);

app.use("/api/student-auth", studentAuthRoutes);
app.use("/api/private-chat", privateChatRoutes);
app.use("/api/ai", aiAssistantRoutes);

// Helper to record immutable Audit Log entries
async function recordAuditLog({ action, actorRole = "admin", actorId = "admin", actorEmail = "", targetType = "", targetId = "", details = {}, req = null }) {
  try {
    await AuditLog.create({
      action,
      actorRole,
      actorId,
      actorEmail,
      targetType,
      targetId,
      details,
      ipAddress: req?.ip || req?.socket?.remoteAddress || "",
      userAgent: req?.headers?.["user-agent"] || "",
    });
  } catch (err) {
    console.error("Audit log error:", err.message);
  }
}

// ===============================
// MONGODB
// ===============================

const resourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    subject: {
      type: String,
      default: "",
      trim: true,
    },

    semester: {
      type: String,
      default: "",
      trim: true,
    },

    type: {
      type: String,
      default: "Notes",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    url: {
      type: String,
      default: "",
      trim: true,
    },

    link: {
      type: String,
      default: "",
      trim: true,
    },

    driveUrl: {
      type: String,
      default: "",
      trim: true,
    },

    unit1: { type: String, default: "", trim: true },
    unit2: { type: String, default: "", trim: true },
    unit3: { type: String, default: "", trim: true },
    unit4: { type: String, default: "", trim: true },
    unit5: { type: String, default: "", trim: true },
    pyq: { type: String, default: "", trim: true },
    ppt: { type: String, default: "", trim: true },

    category: {
      type: String,
      default: "Academic",
      trim: true,
    },

    linkStatus: {
      type: String,
      enum: ["untested", "working", "broken", "restricted"],
      default: "untested",
    },

    lastChecked: {
      type: Date,
      default: null,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Resource = mongoose.model("Resource", resourceSchema);

// ===============================
// USER & LIVE SESSION SCHEMAS
// ===============================

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "Guest Student", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    semester: { type: String, default: "", trim: true },
    currentSubject: { type: String, default: "", trim: true },
    status: { type: String, enum: ["online", "offline"], default: "online" },
    lastActivity: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const sessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, default: "Guest Student" },
    email: { type: String, default: "" },
    currentPage: { type: String, default: "Home", trim: true },
    semester: { type: String, default: "", trim: true },
    subject: { type: String, default: "", trim: true },
    activity: { type: String, default: "Browsing", trim: true },
    isOnline: { type: Boolean, default: true },
    lastActivity: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Session = mongoose.models.Session || mongoose.model("Session", sessionSchema);

// ===============================
// ADMIN SETTINGS
// ===============================

const JWT_SECRET =
  process.env.JWT_SECRET || "srm-note-finder-secret";

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME || "admin";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "admin123";

// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
  res.json({
    message: "SRM Note Finder Backend is running",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
  });
});

// ===============================
// HEALTH CHECK
// ===============================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend is working",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
  });
});

// ===============================
// SUBJECTS
// ===============================

app.get("/api/subjects", (req, res) => {
  res.json({
    success: true,
    message: "Subjects API is working",
  });
});

// ===============================
// ADMIN LOGIN
// ===============================

app.post("/api/admin/login", adminLoginLimiter, async (req, res) => {
  try {
    const trimmedUser = (username || "").trim();
    const trimmedPass = (password || "").trim();

    if (!trimmedUser || !trimmedPass) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    if (
      trimmedUser === ADMIN_USERNAME.trim() &&
      trimmedPass === ADMIN_PASSWORD.trim()
    ) {
      const token = jwt.sign(
        {
          username: ADMIN_USERNAME,
          role: "admin",
        },
        JWT_SECRET,
        {
          expiresIn: "7d",
        }
      );

      await recordAuditLog({
        action: "ADMIN_LOGIN_SUCCESS",
        actorRole: "admin",
        actorId: ADMIN_USERNAME,
        details: { username },
        req,
      });

      return res.json({
        success: true,
        message: "Admin login successful",
        token,
        username: ADMIN_USERNAME,
        admin: {
          username: ADMIN_USERNAME,
          role: "admin",
        },
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid admin username or password",
    });
  } catch (error) {
    console.error("Admin login error:", error);

    res.status(500).json({
      success: false,
      message: "Server error during admin login",
    });
  }
});
 
// ===============================
// ADMIN VERIFY
// ===============================

app.get("/api/admin/verify", (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No admin token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    res.json({
      success: true,
      message: "Admin verified",
      username: decoded.username,
      admin: {
        username: decoded.username,
        role: "admin",
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired admin token",
    });
  }
});

// Helper middleware for admin routes
function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No admin token provided" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired admin token" });
  }
}

// ===============================
// LIVE SESSION TRACKING APIs
// ===============================

app.post("/api/sessions/start", async (req, res) => {
  try {
    const { sessionId, userId, name, email, semester, subject, currentPage, activity } = req.body || {};
    if (!sessionId || !userId) {
      return res.status(400).json({ success: false, message: "sessionId and userId are required" });
    }

    const now = new Date();
    await User.findOneAndUpdate(
      { userId },
      {
        $set: {
          name: name || "Guest Student",
          email: email || "",
          semester: semester || "",
          currentSubject: subject || "",
          status: "online",
          lastActivity: now,
        },
        $setOnInsert: { userId },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    const session = await Session.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          userId,
          name: name || "Guest Student",
          email: email || "",
          currentPage: currentPage || "Home",
          semester: semester || "",
          subject: subject || "",
          activity: activity || "Browsing",
          isOnline: true,
          lastActivity: now,
        },
        $setOnInsert: { sessionId },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    res.json({ success: true, session });
  } catch (error) {
    console.error("Session start error:", error);
    res.status(500).json({ success: false, message: "Unable to start session", error: error.message });
  }
});

app.post("/api/sessions/heartbeat", async (req, res) => {
  try {
    const { sessionId, currentPage, semester, subject, activity } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required" });
    }

    const now = new Date();
    const session = await Session.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          currentPage: currentPage || "Home",
          semester: semester || "",
          subject: subject || "",
          activity: activity || "Browsing",
          isOnline: true,
          lastActivity: now,
        },
      },
      { returnDocument: "after" }
    );

    if (session?.userId) {
      await User.updateOne(
        { userId: session.userId },
        { $set: { status: "online", lastActivity: now } }
      );
    }

    res.json({ success: true, session });
  } catch (error) {
    console.error("Heartbeat error:", error);
    res.status(500).json({ success: false, message: "Unable to update heartbeat", error: error.message });
  }
});

app.get("/api/admin/live-users", requireAdminAuth, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 90 * 1000);

    await Session.updateMany(
      { isOnline: true, lastActivity: { $lt: cutoff } },
      { $set: { isOnline: false } }
    );

    const liveSessions = await Session.find({
      isOnline: true,
      lastActivity: { $gte: cutoff },
    })
      .sort({ lastActivity: -1 })
      .lean();

    const activeUserIds = [...new Set(liveSessions.map((s) => s.userId))];

    await User.updateMany(
      { status: "online", userId: { $nin: activeUserIds } },
      { $set: { status: "offline" } }
    );

    if (activeUserIds.length > 0) {
      await User.updateMany(
        { userId: { $in: activeUserIds } },
        { $set: { status: "online" } }
      );
    }

    res.json({
      success: true,
      count: liveSessions.length,
      users: liveSessions,
    });
  } catch (error) {
    console.error("Live users error:", error);
    res.status(500).json({ success: false, message: "Unable to load live users", error: error.message });
  }
});

app.get("/api/admin/users", requireAdminAuth, async (req, res) => {
  try {
    const students = await StudentAuth.find({})
      .sort({ createdAt: -1 })
      .lean();

    const users = students.map((s) => ({
      _id: s._id,
      userId: s._id.toString(),
      name: s.username || "SRM Student",
      email: s.email,
      status: s.status,
      blockScope: s.blockScope || "none",
      blockedUntil: s.blockedUntil,
      blockReason: s.blockReason,
      emailVerified: s.emailVerified,
      createdAt: s.createdAt,
    }));

    res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Users error:", error);
    res.status(500).json({ success: false, message: "Unable to load users", error: error.message });
  }
});

app.get("/api/admin/analytics", requireAdminAuth, async (req, res) => {
  try {
    const totalResources = await Resource.countDocuments();
    const totalStudents = await StudentAuth.countDocuments();
    const totalSessions = await Session.countDocuments();

    // Active users in last 90s
    const cutoff = new Date(Date.now() - 90 * 1000);
    const activeNow = await Session.countDocuments({ isOnline: true, lastActivity: { $gte: cutoff } });

    // Aggregate resources by semester
    const semBreakdown = await Resource.aggregate([
      { $group: { _id: "$semester", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Aggregate resources by subject (top 6)
    const topSubjects = await Resource.aggregate([
      { $match: { subject: { $ne: "" } } },
      { $group: { _id: "$subject", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]);

    // Material type breakdown
    const typeBreakdown = await Resource.aggregate([
      { $group: { _id: { $ifNull: ["$type", "Notes"] }, count: { $sum: 1 } } },
    ]);

    // Link health stats
    const linkStats = await Resource.aggregate([
      { $group: { _id: { $ifNull: ["$linkStatus", "untested"] }, count: { $sum: 1 } } },
    ]);

    // Recent activity log
    const recentActivity = await Session.find({})
      .sort({ lastActivity: -1 })
      .limit(8)
      .lean();

    res.json({
      success: true,
      analytics: {
        totalResources,
        totalStudents,
        totalSessions,
        activeNow,
        semBreakdown: semBreakdown.map((s) => ({ semester: s._id || "Other", count: s.count })),
        topSubjects: topSubjects.map((s) => ({ subject: s._id, count: s.count })),
        typeBreakdown: typeBreakdown.map((t) => ({ type: t._id, count: t.count })),
        linkStats: linkStats.map((l) => ({ status: l._id, count: l.count })),
        recentActivity: recentActivity.map((a) => ({
          name: a.name || "Student",
          email: a.email || "Guest",
          page: a.currentPage || "Home",
          subject: a.subject || "Browsing",
          time: a.lastActivity,
        })),
      },
    });
  } catch (error) {
    console.error("Analytics endpoint error:", error);
    res.status(500).json({ success: false, message: "Failed to load analytics", error: error.message });
  }
});

// ===============================
// SECURE PDF FILE UPLOAD (ADMIN ONLY)
// ===============================

app.post("/api/admin/upload-pdf", requireAdminAuth, uploadPdf.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No PDF file uploaded. Please select a valid .pdf document.",
      });
    }

    const filePath = req.file.path;

    // Verify PDF Magic Bytes (%PDF-)
    const isValidPdf = verifyPdfMagicBytes(filePath);
    if (!isValidPdf) {
      // Unlink spoofed or malicious file immediately
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: "File integrity check failed: The uploaded file does not contain a valid PDF binary signature.",
      });
    }

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/notes/${req.file.filename}`;

    await recordAuditLog({
      action: "PDF_UPLOAD",
      targetType: "file",
      targetId: req.file.filename,
      details: {
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        url: fileUrl,
      },
      req,
    });

    res.json({
      success: true,
      message: "PDF uploaded and verified successfully.",
      fileUrl,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  } catch (error) {
    console.error("PDF upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process PDF upload.",
    });
  }
});

// ===============================
// AUDIT LOGS QUERY (ADMIN ONLY)
// ===============================

app.get("/api/admin/audit-logs", requireAdminAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const logs = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error("Audit log fetch error:", error);
    res.status(500).json({ success: false, message: "Unable to retrieve audit logs." });
  }
});

// ===============================
// WEBSITE SETTINGS APIs
// ===============================

app.get("/api/settings", async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Load settings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load website settings",
    });
  }
});

app.put("/api/admin/settings", requireAdminAuth, async (req, res) => {
  try {
    const {
      siteName,
      contactEmail,
      maintenanceMode,
      announcement,
      communityChatEnabled,
      privateChatEnabled,
      theme,
      backgroundStyle,
      glowIntensity,
      abusiveWordAction,
      customAbusiveWords,
      spamDetectionEnabled,
    } = req.body;

    const updateData = {};
    if (siteName !== undefined) updateData.siteName = siteName;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
    if (maintenanceMode !== undefined) updateData.maintenanceMode = Boolean(maintenanceMode);
    if (announcement !== undefined) updateData.announcement = announcement;
    if (communityChatEnabled !== undefined) updateData.communityChatEnabled = Boolean(communityChatEnabled);
    if (privateChatEnabled !== undefined) updateData.privateChatEnabled = Boolean(privateChatEnabled);
    if (theme !== undefined) updateData.theme = theme;
    if (backgroundStyle !== undefined) updateData.backgroundStyle = backgroundStyle;
    if (glowIntensity !== undefined) updateData.glowIntensity = glowIntensity;
    if (abusiveWordAction !== undefined) updateData.abusiveWordAction = abusiveWordAction;
    if (customAbusiveWords !== undefined) updateData.customAbusiveWords = customAbusiveWords;
    if (spamDetectionEnabled !== undefined) updateData.spamDetectionEnabled = Boolean(spamDetectionEnabled);

    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: updateData },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
    );

    // If chat or appearance settings updated, broadcast to connected sockets
    if (io) {
      io.emit("chat:settings", {
        communityChatEnabled: settings.communityChatEnabled,
        privateChatEnabled: settings.privateChatEnabled,
      });
      io.emit("site:settings", {
        theme: settings.theme,
        backgroundStyle: settings.backgroundStyle,
        glowIntensity: settings.glowIntensity,
        maintenanceMode: settings.maintenanceMode,
      });
    }

    res.json({
      success: true,
      message: "Website settings saved successfully",
      settings,
    });
  } catch (error) {
    console.error("Save settings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save website settings",
    });
  }
});

// ===============================
// NOTIFICATION APIs
// ===============================

// Public API for students to fetch active announcements
app.get("/api/notifications", async (req, res) => {
  try {
    const now = new Date();
    const notifications = await Notification.find({
      enabled: true,
      published: true,
      $or: [
        { scheduledAt: null },
        { scheduledAt: { $exists: false } },
        { scheduledAt: { $lte: now } },
      ],
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load notifications",
    });
  }
});

// Admin: List all notifications
app.get("/api/admin/notifications", requireAdminAuth, async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error("Admin get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load notifications",
    });
  }
});

// Admin: Create notification
app.post("/api/admin/notifications", requireAdminAuth, async (req, res) => {
  try {
    const {
      title,
      message,
      type,
      theme,
      actionText,
      enabled,
      published,
      scheduledAt,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required",
      });
    }

    const notification = await Notification.create({
      title,
      message,
      type: type || "toast",
      theme: theme || "aurora-cyan",
      actionText: actionText || "",
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      published: published !== undefined ? Boolean(published) : true,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    });

    if (io) {
      io.emit("notification:new", notification);
    }

    res.json({
      success: true,
      message: "Notification created successfully",
      notification,
    });
  } catch (error) {
    console.error("Create notification error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create notification",
    });
  }
});

// Admin: Update/patch notification
app.patch("/api/admin/notifications/:id", requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      message,
      type,
      theme,
      actionText,
      enabled,
      published,
      scheduledAt,
    } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (message !== undefined) updateData.message = message;
    if (type !== undefined) updateData.type = type;
    if (theme !== undefined) updateData.theme = theme;
    if (actionText !== undefined) updateData.actionText = actionText;
    if (enabled !== undefined) updateData.enabled = Boolean(enabled);
    if (published !== undefined) updateData.published = Boolean(published);
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;

    const notification = await Notification.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: "after" }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    if (io) {
      io.emit("notification:updated", notification);
    }

    res.json({
      success: true,
      message: "Notification updated successfully",
      notification,
    });
  } catch (error) {
    console.error("Update notification error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update notification",
    });
  }
});

// Admin: Delete notification
app.delete("/api/admin/notifications/:id", requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndDelete(id);

    if (io) {
      io.emit("notification:deleted", { id });
    }

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
});

// ===============================
// IN-MEMORY CACHE FOR RESOURCES (1000+ USER OPTIMIZATION)
// ===============================
let resourcesCache = null;
let resourcesCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

function invalidateResourcesCache() {
  resourcesCache = null;
  resourcesCacheTime = 0;
}

// ===============================
// GET ALL RESOURCES
// ===============================

app.get("/api/resources", async (req, res) => {
  try {
    const now = Date.now();
    if (resourcesCache && (now - resourcesCacheTime < CACHE_TTL_MS)) {
      return res.json({
        success: true,
        resources: resourcesCache,
        data: resourcesCache,
        cached: true,
      });
    }

    const resources = await Resource.find()
      .sort({ createdAt: -1 })
      .lean();

    resourcesCache = resources;
    resourcesCacheTime = now;

    res.json({
      success: true,
      resources,
      data: resources,
    });
  } catch (error) {
    console.error("Error loading resources:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load resources",
      error: error.message,
    });
  }
});

// ===============================
// GET ONE RESOURCE
// ===============================

app.get("/api/resources/:id", async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    }

    res.json({
      success: true,
      resource,
      data: resource,
    });
  } catch (error) {
    console.error("Error loading resource:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load resource",
      error: error.message,
    });
  }
});

// ===============================
// ADD RESOURCE (PROTECTED ADMIN ROUTE)
// ===============================

app.post("/api/resources", requireAdminAuth, async (req, res) => {
  try {
    const {
      title,
      subject,
      semester,
      type,
      description,
      url,
      link,
      driveUrl,
      category,
      unit1,
      unit2,
      unit3,
      unit4,
      unit5,
      pyq,
      ppt,
    } = req.body;

    if (!title || title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Resource title is required",
      });
    }

    const resource = new Resource({
      title: title.trim().slice(0, 200),
      subject: (subject || "").trim().slice(0, 100),
      semester,
      type: type || "Notes",
      description: (description || "").trim().slice(0, 1000),
      url: url || link || driveUrl || "",
      link: link || driveUrl || url || "",
      driveUrl: driveUrl || link || url || "",
      category,
      unit1: unit1 || "",
      unit2: unit2 || "",
      unit3: unit3 || "",
      unit4: unit4 || "",
      unit5: unit5 || "",
      pyq: pyq || "",
      ppt: ppt || "",
    });

    const savedResource = await resource.save();
    invalidateResourcesCache();

    await recordAuditLog({
      action: "RESOURCE_CREATE",
      targetType: "resource",
      targetId: savedResource._id.toString(),
      details: { title: savedResource.title, subject: savedResource.subject, semester },
      req,
    });

    res.status(201).json({
      success: true,
      message: "Resource added successfully",
      resource: savedResource,
      data: savedResource,
    });
  } catch (error) {
    console.error("Error adding resource:", error);

    res.status(500).json({
      success: false,
      message: "Unable to add resource",
      error: error.message,
    });
  }
});

// ===============================
// UPDATE RESOURCE (PROTECTED ADMIN ROUTE)
// ===============================

app.put("/api/resources/:id", requireAdminAuth, async (req, res) => {
  try {
    const updatedResource =
      await Resource.findByIdAndUpdate(
        req.params.id,
        {
          $set: req.body,
        },
        {
          returnDocument: "after",
          runValidators: true,
        }
      );

    if (!updatedResource) {
      return res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    }

    invalidateResourcesCache();

    await recordAuditLog({
      action: "RESOURCE_UPDATE",
      targetType: "resource",
      targetId: req.params.id,
      details: { title: updatedResource.title },
      req,
    });

    res.json({
      success: true,
      message: "Resource updated successfully",
      resource: updatedResource,
      data: updatedResource,
    });
  } catch (error) {
    console.error("Error updating resource:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update resource",
      error: error.message,
    });
  }
});

// ===============================
// DELETE RESOURCE (PROTECTED ADMIN ROUTE)
// ===============================

app.delete("/api/resources/:id", requireAdminAuth, async (req, res) => {
  try {
    const deletedResource =
      await Resource.findByIdAndDelete(req.params.id);

    if (!deletedResource) {
      return res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    }

    invalidateResourcesCache();

    await recordAuditLog({
      action: "RESOURCE_DELETE",
      targetType: "resource",
      targetId: req.params.id,
      details: { title: deletedResource.title },
      req,
    });

    res.json({
      success: true,
      message: "Resource deleted successfully",
      resource: deletedResource,
    });
  } catch (error) {
    console.error("Error deleting resource:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete resource",
      error: error.message,
    });
  }
});

// ===============================
// SEARCH RESOURCES
// ===============================

app.get("/api/resources/search", async (req, res) => {
  try {
    const q = req.query.q || "";

    const resources = await Resource.find({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { subject: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { type: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      resources,
      data: resources,
    });
  } catch (error) {
    console.error("Resource search error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to search resources",
      error: error.message,
    });
  }
});

// ===============================
// BULK RESOURCE UPLOAD / CSV IMPORT
// ===============================

app.post("/api/resources/bulk", requireAdminAuth, async (req, res) => {
  try {
    const { items } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "An array of items is required for bulk upload",
      });
    }

    if (items.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Maximum 500 resources can be imported at once",
      });
    }

    const validDocs = [];
    const skipped = [];

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      const title = (row.title || row.Title || "").trim();
      const subject = (row.subject || row.Subject || "").trim();
      const semester = (row.semester || row.Semester || "").toString().trim();
      const type = (row.type || row.Type || "Notes").trim();
      const link = (row.driveUrl || row.DriveUrl || row.link || row.Link || row.url || row.Url || "").trim();
      const description = (row.description || row.Description || "").trim();
      const category = (row.category || row.Category || "Academic").trim();

      if (!title) {
        skipped.push({ row: i + 1, reason: "Missing title" });
        continue;
      }

      validDocs.push({
        title: title.slice(0, 200),
        subject: subject.slice(0, 100),
        semester,
        type: type || "Notes",
        link,
        url: link,
        driveUrl: link,
        description: description.slice(0, 1000),
        category,
        linkStatus: "untested",
        createdAt: new Date(),
      });
    }

    if (validDocs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid resource rows found in the provided data",
        skipped,
      });
    }

    const inserted = await Resource.insertMany(validDocs);
    invalidateResourcesCache();

    await recordAuditLog({
      action: "RESOURCE_BULK_IMPORT",
      targetType: "resource",
      details: { count: inserted.length, skippedCount: skipped.length },
      req,
    });

    res.json({
      success: true,
      message: `Successfully imported ${inserted.length} resources!`,
      importedCount: inserted.length,
      skippedCount: skipped.length,
      skipped,
    });
  } catch (error) {
    console.error("Bulk resource upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk upload resources",
      error: error.message,
    });
  }
});

// ===============================
// AUTOMATED & MANUAL BROKEN LINK HEALTH CHECKER
// ===============================

async function checkSingleUrl(targetUrl) {
  if (!targetUrl || typeof targetUrl !== "string") {
    return "broken";
  }
  const cleanUrl = targetUrl.trim();
  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    return "broken";
  }

  // Google Drive specific quick verification
  if (cleanUrl.includes("drive.google.com") || cleanUrl.includes("docs.google.com")) {
    // If it's a standard sharing link format, inspect with quick HEAD/GET
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const resp = await fetch(cleanUrl, {
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      clearTimeout(timeoutId);

      if (resp.status === 404) return "broken";
      if (resp.status === 403) return "restricted";
      return "working";
    } catch {
      return "broken";
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(cleanUrl, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    clearTimeout(timeoutId);

    if (resp.status >= 200 && resp.status < 400) return "working";
    if (resp.status === 403) return "restricted";
    return "broken";
  } catch {
    return "broken";
  }
}

app.post("/api/resources/check-links", requireAdminAuth, async (req, res) => {
  try {
    const resources = await Resource.find({}).lean();
    let checkedCount = 0;
    let brokenCount = 0;
    let workingCount = 0;
    const results = [];

    // Check in batches of 5 to avoid overwhelming connection pool
    for (let i = 0; i < resources.length; i += 5) {
      const batch = resources.slice(i, i + 5);
      await Promise.all(
        batch.map(async (doc) => {
          const testUrl = doc.driveUrl || doc.link || doc.url;
          let status = "untested";
          if (!testUrl) {
            status = "broken";
          } else {
            status = await checkSingleUrl(testUrl);
          }

          await Resource.updateOne(
            { _id: doc._id },
            { $set: { linkStatus: status, lastChecked: new Date() } }
          );

          checkedCount++;
          if (status === "working") workingCount++;
          if (status === "broken" || status === "restricted") brokenCount++;

          results.push({
            id: doc._id,
            title: doc.title,
            url: testUrl,
            status,
          });
        })
      );
    }

    invalidateResourcesCache();

    res.json({
      success: true,
      message: `Checked ${checkedCount} resources. ${workingCount} working, ${brokenCount} issue(s) detected.`,
      checkedCount,
      workingCount,
      brokenCount,
      results,
    });
  } catch (error) {
    console.error("Link health check error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete link health check",
      error: error.message,
    });
  }
});

// Weekly scheduled background link checker (every Sunday at midnight)
setInterval(async () => {
  try {
    console.log("[HealthChecker] Running automated background link check...");
    const resources = await Resource.find({}).lean();
    for (let i = 0; i < resources.length; i += 5) {
      const batch = resources.slice(i, i + 5);
      await Promise.all(
        batch.map(async (doc) => {
          const testUrl = doc.driveUrl || doc.link || doc.url;
          const status = testUrl ? await checkSingleUrl(testUrl) : "broken";
          await Resource.updateOne(
            { _id: doc._id },
            { $set: { linkStatus: status, lastChecked: new Date() } }
          );
        })
      );
    }
    invalidateResourcesCache();
    console.log("[HealthChecker] Completed background link check.");
  } catch (err) {
    console.error("[HealthChecker] Background check failed:", err.message);
  }
}, 7 * 24 * 60 * 60 * 1000);

// ===============================
// 404
// ===============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ===============================
// ERROR HANDLER
// ===============================

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: error.message,
  });
});

// ===============================
// START SERVER
// ===============================

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error(
        "MONGODB_URI is missing from your .env file"
      );
      process.exit(1);
    }

    mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
      .then(() => {
        console.log("=================================");
        console.log("MongoDB connected successfully");
        console.log("=================================");
      })
      .catch((err) => {
        console.warn("=================================");
        console.warn("MongoDB Atlas connection pending/warning:", err.message);
        console.warn("Backend server is running and AI endpoints are fully operational.");
        console.warn("=================================");
      });

io.on("connection", (socket) => {
  console.log("Chat client connected:", socket.id);

  let lastMessageTime = 0;

  async function getChatSettings() {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({});
    }

    return settings;
  }

  async function verifyStudentToken(token) {
    if (!token || typeof token !== "string") return null;
    try {
      const secret = process.env.JWT_SECRET || "srm-note-finder-secret";
      const decoded = jwt.verify(token, secret);
      if (decoded?.role !== "student" || !decoded?.sub) return null;

      const student = await StudentAuth.findOne({
        _id: decoded.sub,
        emailVerified: true,
      }).select("_id email username status blockScope blockedUntil blockReason");

      if (!student) return null;

      // Check permanent website or chat block
      if (student.status === "blocked") {
        return { blocked: true, message: "Your account is permanently restricted." };
      }

      // Check temporary block
      if (student.blockedUntil && new Date() < new Date(student.blockedUntil)) {
        const scope = student.blockScope || "all_chat";
        if (scope === "community" || scope === "all_chat" || scope === "website") {
          const mins = Math.ceil((new Date(student.blockedUntil) - new Date()) / 60000);
          return {
            blocked: true,
            message: `You are temporarily restricted from chatting for ${mins} minute(s). Reason: ${student.blockReason || "Policy violation"}`,
          };
        }
      }

      return student;
    } catch {
      return null;
    }
  }

  socket.on("community:load", async (payload) => {
    try {
      const settings = await getChatSettings();

      socket.emit("chat:settings", {
        communityChatEnabled: settings.communityChatEnabled,
        privateChatEnabled: settings.privateChatEnabled,
      });

      if (!settings.communityChatEnabled) {
        socket.emit("chat:error", {
          message: "Community chat is currently disabled by the admin.",
        });
        return;
      }

      const token = socket.handshake.auth?.token || payload?.token;
      const student = await verifyStudentToken(token);

      if (!student) {
        socket.emit("chat:error", {
          message: "Please sign in with your verified student account to view community chat.",
          authRequired: true,
        });
        return;
      }

      const messages = await ChatMessage.find({
        type: "community",
        expiresAt: { $gt: new Date() },
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      socket.emit("community:history", messages.reverse());
    } catch (error) {
      console.error("Community history error:", error.message);
      socket.emit("chat:error", {
        message: "Unable to load community messages.",
      });
    }
  });

  socket.on("community:send", async (payload) => {
    try {
      const settings = await getChatSettings();

      if (!settings.communityChatEnabled) {
        socket.emit("chat:error", {
          message: "Community chat is currently disabled by the admin.",
        });
        return;
      }

      const token = socket.handshake.auth?.token || payload?.token;
      const student = await verifyStudentToken(token);

      if (!student) {
        socket.emit("chat:error", {
          message: "Please sign in with your verified student account to send messages.",
          authRequired: true,
        });
        return;
      }

      if (student.blocked) {
        socket.emit("chat:error", {
          message: student.message,
        });
        return;
      }

      const text =
        typeof payload?.text === "string"
          ? payload.text.trim()
          : "";

      if (!text || text.length > 2000) {
        socket.emit("chat:error", {
          message: "Message must contain 1–2000 characters.",
        });
        return;
      }

      const now = Date.now();

      if (now - lastMessageTime < 1000) {
        socket.emit("chat:error", {
          message: "Please wait before sending another message.",
        });
        return;
      }

      // Check spam / rate limiting
      if (settings.spamDetectionEnabled !== false) {
        const spamCheck = checkSpam(student._id.toString(), text);
        if (spamCheck.isSpam) {
          if (spamCheck.shouldBlock) {
            // Progressive penalty: temporary 10-minute block on community chat
            const blockUntil = new Date(Date.now() + 10 * 60 * 1000);
            await StudentAuth.findByIdAndUpdate(student._id, {
              status: "active",
              blockScope: "community",
              blockedUntil: blockUntil,
              blockReason: "Repeated message flooding/spamming",
            });
            socket.emit("chat:error", {
              message: "Your chat access has been temporarily paused for 10 minutes due to repeated spamming.",
            });
            return;
          }
          socket.emit("chat:error", {
            message: spamCheck.reason,
          });
          return;
        }
      }

      // Analyze abusive words with anti-obfuscation normalization
      const combinedWordlist = [
        ...DEFAULT_ABUSIVE_WORDS,
        ...(settings.customAbusiveWords || []),
      ];
      const moderationResult = analyzeAbuse(text, combinedWordlist);

      let processedText = text;
      if (moderationResult.containsAbuse) {
        const action = settings.abusiveWordAction || "mask";
        if (action === "reject") {
          socket.emit("chat:error", {
            message: "Your message was rejected because it contains inappropriate or abusive language.",
          });
          return;
        } else if (action === "warn") {
          socket.emit("chat:warning", {
            message: "Warning: Please keep community discussions polite and respectful.",
          });
        }
        // If action is "mask" or fallback, replace offending terms with asterisks
        processedText = moderationResult.maskedText;
      }

      lastMessageTime = now;

      const displayName =
        student.username ||
        student.email.split("@")[0] ||
        "Student";

      const savedMessage = await ChatMessage.create({
        type: "community",
        senderId: student._id.toString(),
        senderName: displayName,
        text: processedText,
      });

      io.emit("community:message", savedMessage.toObject());
    } catch (error) {
      console.error("Community send error:", error.message);
      socket.emit("chat:error", {
        message: "Unable to send your message.",
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Chat client disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
  console.log(`Resources API: http://localhost:${PORT}/api/resources`);
  console.log(`Admin Login API: http://localhost:${PORT}/api/admin/login`);
  console.log("Socket.IO chat server is ready");
});

  } catch (error) {
    console.error("=================================");
    console.error("MongoDB connection failed");
    console.error("=================================");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();