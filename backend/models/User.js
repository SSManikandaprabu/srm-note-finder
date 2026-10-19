const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },

    username: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9._%+-]+@srmist\.edu\.in$/,
    },

    passwordHash: {
      type: String,
      select: false,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationCodeHash: {
      type: String,
      select: false,
    },

    emailVerificationExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
    },

    currentPage: {
      type: String,
      default: "home",
    },

    currentSemester: {
      type: String,
      default: "",
    },

    currentSubject: {
      type: String,
      default: "",
    },

    lastSeen: {
      type: Date,
      default: Date.now,
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

module.exports = mongoose.model("User", userSchema);