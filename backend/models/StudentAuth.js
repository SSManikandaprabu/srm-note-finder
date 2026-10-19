const mongoose = require("mongoose");

const studentAuthSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9._%+-]+@srmist\.edu\.in$/,
    },

    username: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    verificationCodeHash: {
      type: String,
      select: false,
    },
verificationAttempts: { type: Number, default: 0, min: 0, max: 5 },

    verificationExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
    },

    // Detailed multi-level block system
    blockedUntil: {
      type: Date,
      default: null,
    },
    blockScope: {
      type: String,
      enum: ["none", "community", "private", "all_chat", "website"],
      default: "none",
    },
    blockReason: {
      type: String,
      default: "",
    },
    bookmarks: [
      {
        resourceId: { type: String, default: "" },
        subject: { type: String, required: true },
        semester: { type: Number, required: true },
        unit: { type: String, default: "All" },
        title: { type: String, default: "" },
        link: { type: String, default: "" },
        savedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("StudentAuth", studentAuthSchema);