const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
  {
    semester: {
      type: Number,
      required: true
    },

    subject: {
      type: String,
      required: true
    },

    unit1: {
      type: String,
      default: ""
    },

    unit2: {
      type: String,
      default: ""
    },

    unit3: {
      type: String,
      default: ""
    },

    unit4: {
      type: String,
      default: ""
    },

    unit5: {
      type: String,
      default: ""
    },

    pyq: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Resource", resourceSchema);