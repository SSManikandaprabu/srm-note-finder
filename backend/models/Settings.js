const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    siteName: {
      type: String,
      default: "SRM Note Finder",
    },
    contactEmail: {
      type: String,
      default: "",
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    announcement: {
      type: String,
      default: "",
    },
    communityChatEnabled: {
      type: Boolean,
      default: true,
    },
    privateChatEnabled: {
      type: Boolean,
      default: false,
    },
    theme: {
      type: String,
      default: "aurora-cyan",
    },
    backgroundStyle: {
      type: String,
      default: "aurora",
    },
    glowIntensity: {
      type: String,
      default: "medium",
    },
    // Step 3 Moderation Rules
    abusiveWordAction: {
      type: String,
      enum: ["mask", "reject", "warn"],
      default: "mask",
    },
    customAbusiveWords: {
      type: [String],
      default: [],
    },
    spamDetectionEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Settings", settingsSchema);