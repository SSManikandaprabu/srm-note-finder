const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
      // e.g. "ADMIN_LOGIN", "BLOCK_USER", "UNBLOCK_USER", "DELETE_MESSAGE", "UPLOAD_PDF", "UPDATE_RESOURCE", "DELETE_RESOURCE", "UPDATE_SETTINGS"
    },
    actorRole: {
      type: String,
      enum: ["admin", "student", "system"],
      default: "admin",
    },
    actorId: {
      type: String,
      default: "admin",
    },
    actorEmail: {
      type: String,
      default: "",
    },
    targetType: {
      type: String,
      default: "",
      // e.g. "student", "resource", "message", "settings", "file"
    },
    targetId: {
      type: String,
      default: "",
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

