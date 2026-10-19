const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Ensure secure uploads directory exists
const uploadDir = path.join(__dirname, "..", "uploads", "notes");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed MIME types and extensions
const ALLOWED_MIME_TYPES = new Set(["application/pdf"]);
const ALLOWED_EXTENSIONS = new Set([".pdf"]);

// 25 MB Max PDF File Size
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unpredictable collision-resistant filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // Sanitize original filename (strip non-alphanumeric except extension)
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 50);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  // 1. Strict extension check
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error("Invalid file extension. Only genuine PDF documents (.pdf) are permitted."), false);
  }

  // 2. Strict MIME type check
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error("Invalid MIME type. The uploaded file is not recognized as application/pdf."), false);
  }

  cb(null, true);
}

const uploadPdf = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Only 1 file per upload request
  },
  fileFilter,
});

/**
 * Validates magic number / PDF header bytes (%PDF-) to prevent polyglot / renamed malicious executables
 */
function verifyPdfMagicBytes(filePath) {
  try {
    const buffer = Buffer.alloc(5);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 5, 0);
    fs.closeSync(fd);
    // PDF files must start with %PDF- (ASCII bytes 0x25, 0x50, 0x44, 0x46, 0x2D)
    return buffer.toString("ascii") === "%PDF-";
  } catch (err) {
    console.error("PDF header verification error:", err);
    return false;
  }
}

module.exports = {
  uploadPdf,
  verifyPdfMagicBytes,
  MAX_FILE_SIZE,
};

