
const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["community", "private"],
      required: true,
      index: true,
    },

    senderId: {
      type: String,
      required: true,
    },

    senderName: {
      type: String,
      required: true,
      maxlength: 100,
    },

    receiverId: {
      type: String,
      default: null,
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    read: {
      type: Boolean,
      default: false,
    },

    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      expires: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
