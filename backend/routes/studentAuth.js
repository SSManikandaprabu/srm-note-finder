
const express = require("express");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const StudentAuth = require("../models/StudentAuth");

const router = express.Router();

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validCollegeEmail(email) {
  return /^[a-z0-9._%+-]+@srmist\.edu\.in$/.test(email);
}

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } =
    process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    throw new Error("Email service is not configured");
  }

  return {
    transporter: nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    }),
    from: SMTP_FROM,
  };
}

function hashCode(code) {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET || "")
    .update(code)
    .digest("hex");
}

function createStudentToken(student) {
  return jwt.sign(
    {
      sub: student._id.toString(),
      role: "student",
      email: student.email,
    },
    process.env.JWT_SECRET || "srm-note-finder-secret",
    { expiresIn: "8h" }
  );
}

router.post("/register", emailLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    const username =
      typeof req.body?.username === "string"
        ? req.body.username.trim().slice(0, 100)
        : "";

    if (!validCollegeEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Use an email ending in @srmist.edu.in.",
      });
    }

    if (typeof password !== "string" || password.length < 10 || password.length > 128) {
      return res.status(400).json({
        success: false,
        message: "Password must be 10–128 characters long.",
      });
    }

    const existing = await StudentAuth.findOne({ email });

    if (existing?.emailVerified) {
      return res.status(409).json({
        success: false,
        message: "An account already exists. Please sign in.",
      });
    }

   if (existing) {
  await StudentAuth.deleteOne({ _id: existing._id });
}
    const code = crypto.randomInt(100000, 1000000).toString();
    const passwordHash = await bcrypt.hash(password, 12);

    const { transporter, from } = createTransporter();

    const student = await StudentAuth.create({
      email,
      username,
      passwordHash,
      emailVerified: false,
      verificationCodeHash: hashCode(code),
      verificationAttempts: 0,
      verificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject: "SRM Note Finder email verification",
        text: `Your verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
      });
    } catch (error) {
      await StudentAuth.deleteOne({ _id: student._id });
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Verification code sent to your college email.",
    });
  } catch (error) {
    console.error("Student registration error:", error.message);

    return res.status(503).json({
      success: false,
      message: "Registration could not be completed. Check the email service configuration.",
    });
  }
});

router.post("/verify-email", emailLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code =
      typeof req.body?.code === "string" ? req.body.code.trim() : "";

    if (!validCollegeEmail(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid college email and six-digit code.",
      });
    }

    const student = await StudentAuth.findOne({ email })
  .select("+verificationCodeHash +verificationExpiresAt +verificationAttempts");

  if (
  !student ||
  student.emailVerified ||
  !student.verificationCodeHash ||
  !student.verificationExpiresAt ||
  student.verificationExpiresAt.getTime() < Date.now() ||
  student.verificationAttempts >= 5
) {
      return res.status(400).json({
        success: false,
        message: "The code is invalid or expired. Register again or contact support.",
      });
    }

    const submittedHash = Buffer.from(hashCode(code), "hex");
    const storedHash = Buffer.from(student.verificationCodeHash, "hex");

    if (
  submittedHash.length !== storedHash.length ||
  !crypto.timingSafeEqual(submittedHash, storedHash)
) {
  student.verificationAttempts += 1;
  await student.save();

  return res.status(400).json({
    success: false,
    message:
      student.verificationAttempts >= 5
        ? "Too many incorrect attempts. Register again or contact support."
        : "Invalid verification code.",
  });
}
   student.emailVerified = true;
student.verificationCodeHash = undefined;
student.verificationExpiresAt = null;
student.verificationAttempts = 0;
await student.save();

    return res.json({
      success: true,
      message: "Email verified. You can now sign in.",
    });
  } catch (error) {
    console.error("Email verification error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to verify the email right now.",
    });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (
      !validCollegeEmail(email) ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid college email and password.",
      });
    }

    const student = await StudentAuth.findOne({ email })
      .select("+passwordHash");

    if (!student || !(await bcrypt.compare(password, student.passwordHash))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!student.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Verify your college email before signing in.",
      });
    }

    if (student.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "This account is blocked.",
      });
    }

    return res.json({
      success: true,
      token: createStudentToken(student),
      student: {
        id: student._id.toString(),
        email: student.email,
        username: student.username,
        bookmarks: student.bookmarks || [],
      },
    });
  } catch (error) {
    console.error("Student login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to sign in right now.",
    });
  }
});

// Middleware to authenticate verified student
function authenticateStudent(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Student authentication required." });
    }
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "srm-note-finder-secret");
    if (decoded.role !== "student") {
      return res.status(403).json({ success: false, message: "Student access required." });
    }
    req.studentId = decoded.sub;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired student session." });
  }
}

// GET student bookmarks
router.get("/bookmarks", authenticateStudent, async (req, res) => {
  try {
    const student = await StudentAuth.findById(req.studentId).select("bookmarks");
    if (!student) {
      return res.status(404).json({ success: false, message: "Student account not found." });
    }
    res.json({ success: true, bookmarks: student.bookmarks || [] });
  } catch (error) {
    console.error("Fetch bookmarks error:", error.message);
    res.status(500).json({ success: false, message: "Unable to fetch bookmarks." });
  }
});

// POST toggle student bookmark
router.post("/bookmarks", authenticateStudent, async (req, res) => {
  try {
    const { subject, semester, unit, title, link, resourceId } = req.body;
    if (!subject || !semester) {
      return res.status(400).json({ success: false, message: "Subject and semester are required to bookmark." });
    }

    const student = await StudentAuth.findById(req.studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student account not found." });
    }

    const existingIndex = student.bookmarks.findIndex(
      (b) => b.subject.toLowerCase() === subject.toLowerCase() && Number(b.semester) === Number(semester) && (b.unit || "All") === (unit || "All")
    );

    let isBookmarked = false;
    if (existingIndex > -1) {
      // Remove bookmark
      student.bookmarks.splice(existingIndex, 1);
      isBookmarked = false;
    } else {
      // Add bookmark
      student.bookmarks.unshift({
        resourceId: resourceId || "",
        subject,
        semester: Number(semester),
        unit: unit || "All",
        title: title || `${subject} - Unit ${unit || "All"}`,
        link: link || "",
        savedAt: new Date(),
      });
      isBookmarked = true;
    }

    await student.save();

    res.json({
      success: true,
      isBookmarked,
      message: isBookmarked ? "Added to your Bookmarks!" : "Removed from Bookmarks.",
      bookmarks: student.bookmarks,
    });
  } catch (error) {
    console.error("Toggle bookmark error:", error.message);
    res.status(500).json({ success: false, message: "Unable to update bookmark." });
  }
});

module.exports = router;
