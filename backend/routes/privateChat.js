
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const StudentAuth = require("../models/StudentAuth");
const ChatMessage = require("../models/ChatMessage");
const AuditLog = require("../models/AuditLog");
const { analyzeAbuse, checkSpam } = require("../utils/moderation");

const router = express.Router();

function getJwtSecret() {
  return process.env.JWT_SECRET || "srm-note-finder-secret";
}

function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    req.auth = jwt.verify(header.slice(7), getJwtSecret());
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
}

function requireAdmin(req, res, next) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required." });
  }
  next();
}

function requireStudent(req, res, next) {
  if (req.auth?.role !== "student" || !mongoose.isValidObjectId(req.auth.sub)) {
    return res.status(403).json({ success: false, message: "Student access required." });
  }
  next();
}

async function getActiveStudent(id) {
  const student = await StudentAuth.findOne({
    _id: id,
    emailVerified: true,
  }).select("_id email username status blockScope blockedUntil blockReason");
  return student;
}

function checkStudentBlock(student, actionScope) {
  if (!student) return "Student account not found.";
  if (student.status === "blocked" && !student.blockedUntil) {
    return "Your account has been permanently restricted by the administrator.";
  }
  if (student.blockedUntil) {
    if (new Date() < new Date(student.blockedUntil)) {
      const minutesLeft = Math.ceil((new Date(student.blockedUntil) - new Date()) / 60000);
      const scope = student.blockScope || "all_chat";
      if (scope === "website" || scope === "all_chat" || scope === actionScope) {
        return `You are temporarily restricted from ${actionScope === "private" ? "private messaging" : "chatting"} for another ${minutesLeft} minute(s). Reason: ${student.blockReason || "Policy violation"}`;
      }
    }
  }
  return null;
}

// Admin: get total unread messages count across all students
router.get("/unread-count", authenticate, requireAdmin, async (req, res) => {
  try {
    const unreadCount = await ChatMessage.countDocuments({
      type: "private",
      receiverId: "admin",
      read: { $ne: true },
      expiresAt: { $gt: new Date() },
    });

    res.json({ success: true, unreadCount });
  } catch (error) {
    console.error("Unread count error:", error.message);
    res.status(500).json({ success: false, unreadCount: 0 });
  }
});

// Admin: list only verified, active student accounts with unread counts.
router.get("/students", authenticate, requireAdmin, async (req, res) => {
  try {
    const students = await StudentAuth.find({
      emailVerified: true,
    })
      .select("_id email username status blockScope blockedUntil blockReason createdAt")
      .sort({ email: 1 })
      .limit(500)
      .lean();

    // Attach unread count and latest message preview for each student
    const studentsWithMeta = await Promise.all(
      students.map(async (student) => {
        const studentId = student._id.toString();
        const unread = await ChatMessage.countDocuments({
          type: "private",
          senderId: studentId,
          receiverId: "admin",
          read: { $ne: true },
          expiresAt: { $gt: new Date() },
        });

        const latestMsg = await ChatMessage.findOne({
          type: "private",
          $or: [
            { senderId: "admin", receiverId: studentId },
            { senderId: studentId, receiverId: "admin" },
          ],
          expiresAt: { $gt: new Date() },
        })
          .sort({ createdAt: -1 })
          .select("text createdAt senderId")
          .lean();

        return {
          ...student,
          unreadCount: unread,
          latestMessage: latestMsg || null,
        };
      })
    );

    // Sort students with recent unread messages first
    studentsWithMeta.sort((a, b) => {
      if (b.unreadCount !== a.unreadCount) {
        return b.unreadCount - a.unreadCount;
      }
      const timeA = a.latestMessage?.createdAt ? new Date(a.latestMessage.createdAt).getTime() : 0;
      const timeB = b.latestMessage?.createdAt ? new Date(b.latestMessage.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    res.json({ success: true, students: studentsWithMeta });
  } catch (error) {
    console.error("Private chat student list error:", error.message);
    res.status(500).json({ success: false, message: "Unable to load students." });
  }
});

// Admin: load the conversation with one verified student.
router.get("/admin/:studentId/messages", authenticate, requireAdmin, async (req, res) => {
  try {
    const student = await getActiveStudent(req.params.studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    const messages = await ChatMessage.find({
      type: "private",
      $or: [
        { senderId: "admin", receiverId: student._id.toString() },
        { senderId: student._id.toString(), receiverId: "admin" },
      ],
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    // Mark messages sent by this student as read
    await ChatMessage.updateMany(
      {
        type: "private",
        senderId: student._id.toString(),
        receiverId: "admin",
        read: { $ne: true },
      },
      { $set: { read: true } }
    );

    res.json({ success: true, student, messages });
  } catch (error) {
    console.error("Private chat admin history error:", error.message);
    res.status(500).json({ success: false, message: "Unable to load messages." });
  }
});

// Admin: send a message to one verified student.
router.post("/admin/:studentId/messages", authenticate, requireAdmin, async (req, res) => {
  try {
    const student = await getActiveStudent(req.params.studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text || text.length > 2000) {
      return res.status(400).json({ success: false, message: "Message must be 1-2000 characters." });
    }

    const message = await ChatMessage.create({
      type: "private",
      senderId: "admin",
      senderName: "Admin",
      receiverId: student._id.toString(),
      text,
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error("Private chat admin send error:", error.message);
    res.status(500).json({ success: false, message: "Unable to send message." });
  }
});

// Student: load only their own conversation with the admin.
router.get("/messages", authenticate, requireStudent, async (req, res) => {
  try {
    const student = await getActiveStudent(req.auth.sub);
    if (!student) {
      return res.status(403).json({ success: false, message: "Active verified student account required." });
    }

    const id = student._id.toString();
    const messages = await ChatMessage.find({
      type: "private",
      $or: [
        { senderId: "admin", receiverId: id },
        { senderId: id, receiverId: "admin" },
      ],
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    res.json({ success: true, messages });
  } catch (error) {
    console.error("Private chat student history error:", error.message);
    res.status(500).json({ success: false, message: "Unable to load messages." });
  }
});

// Student: reply only to the admin.
router.post("/messages", authenticate, requireStudent, async (req, res) => {
  try {
    const student = await getActiveStudent(req.auth.sub);
    if (!student) {
      return res.status(403).json({ success: false, message: "Active verified student account required." });
    }

    const restriction = checkStudentBlock(student, "private");
    if (restriction) {
      return res.status(403).json({ success: false, message: restriction });
    }

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text || text.length > 2000) {
      return res.status(400).json({ success: false, message: "Message must be 1-2000 characters." });
    }

    // Moderation and spam checks
    const spamCheck = checkSpam(student._id.toString(), text);
    if (spamCheck.isSpam) {
      return res.status(429).json({ success: false, message: spamCheck.reason });
    }

    const moderationResult = analyzeAbuse(text);
    let processedText = text;
    if (moderationResult.containsAbuse) {
      processedText = moderationResult.maskedText;
    }

    const message = await ChatMessage.create({
      type: "private",
      senderId: student._id.toString(),
      senderName: student.username || student.email,
      receiverId: "admin",
      text: processedText,
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error("Private chat student send error:", error.message);
    res.status(500).json({ success: false, message: "Unable to send message." });
  }
});

// Admin: Block student (10 min, 24 hours, or permanent) across specific scope
router.post("/admin/:studentId/block", authenticate, requireAdmin, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { duration, scope, reason } = req.body;
    // duration: '10m', '24h', 'permanent'
    // scope: 'community', 'private', 'all_chat', 'website'

    let blockedUntil = null;
    let status = "active";

    if (duration === "10m") {
      blockedUntil = new Date(Date.now() + 10 * 60 * 1000);
    } else if (duration === "24h") {
      blockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else if (duration === "permanent") {
      status = "blocked";
      blockedUntil = null;
    }

    const updated = await StudentAuth.findByIdAndUpdate(
      studentId,
      {
        $set: {
          status,
          blockedUntil,
          blockScope: scope || "all_chat",
          blockReason: reason || "Violation of community standards",
        },
      },
      { returnDocument: "after" }
    ).select("_id email username status blockedUntil blockScope blockReason");

    if (!updated) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    await AuditLog.create({
      action: "STUDENT_BLOCK",
      actorRole: "admin",
      actorId: "admin",
      targetType: "student",
      targetId: studentId,
      details: { email: updated.email, duration, scope, reason },
      ipAddress: req.ip || "",
      userAgent: req.headers["user-agent"] || "",
    });

    res.json({
      success: true,
      message: `Student restriction applied successfully (${duration}).`,
      student: updated,
    });
  } catch (error) {
    console.error("Block student error:", error.message);
    res.status(500).json({ success: false, message: "Failed to block student." });
  }
});

// Admin: Unblock student
router.post("/admin/:studentId/unblock", authenticate, requireAdmin, async (req, res) => {
  try {
    const { studentId } = req.params;

    const updated = await StudentAuth.findByIdAndUpdate(
      studentId,
      {
        $set: {
          status: "active",
          blockedUntil: null,
          blockScope: "none",
          blockReason: "",
        },
      },
      { returnDocument: "after" }
    ).select("_id email username status blockedUntil blockScope blockReason");

    if (!updated) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    await AuditLog.create({
      action: "STUDENT_UNBLOCK",
      actorRole: "admin",
      actorId: "admin",
      targetType: "student",
      targetId: studentId,
      details: { email: updated.email },
      ipAddress: req.ip || "",
      userAgent: req.headers["user-agent"] || "",
    });

    res.json({
      success: true,
      message: "Student unblocked successfully.",
      student: updated,
    });
  } catch (error) {
    console.error("Unblock student error:", error.message);
    res.status(500).json({ success: false, message: "Failed to unblock student." });
  }
});

// Admin: Delete any message (private or community)
router.delete("/admin/messages/:messageId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { messageId } = req.params;
    const deleted = await ChatMessage.findByIdAndDelete(messageId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Message not found." });
    }

    await AuditLog.create({
      action: "MESSAGE_DELETE",
      actorRole: "admin",
      actorId: "admin",
      targetType: "message",
      targetId: messageId,
      details: { type: deleted.type, senderId: deleted.senderId, senderName: deleted.senderName },
      ipAddress: req.ip || "",
      userAgent: req.headers["user-agent"] || "",
    });

    res.json({ success: true, message: "Message deleted successfully.", deletedId: messageId });
  } catch (error) {
    console.error("Delete message error:", error.message);
    res.status(500).json({ success: false, message: "Failed to delete message." });
  }
});

module.exports = router;
