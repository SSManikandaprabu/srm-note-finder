
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: ["toast", "banner", "modal", "inline", "push"],
      default: "banner",
    },
    theme: {
      type: String,
      enum: ["neon", "glass", "minimal", "aurora-cyan", "royal-purple", "deep-ocean", "emerald"],
      default: "aurora-cyan",
    },
    actionText: {
      type: String,
      default: "",
      maxlength: 40,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    published: {
      type: Boolean,
      default: false,
    },
scheduledAt: {
  type: Date,
  default: null,
},

  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Notification", notificationSchema);
