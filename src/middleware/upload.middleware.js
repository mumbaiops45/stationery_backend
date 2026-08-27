const multer = require("multer");

// ======================================================
// UPLOAD MIDDLEWARE
//
// Files are held in memory and streamed straight to
// Cloudinary, so the API server never writes to disk
// (Render/Vercel filesystems are ephemeral anyway).
// ======================================================

const MAX_FILE_SIZE_MB =
  Number(
    process.env
      .MAX_UPLOAD_SIZE_MB
  ) || 5;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

const fileFilter = (
  req,
  file,
  callback
) => {
  if (
    ALLOWED_MIME_TYPES.includes(
      file.mimetype
    )
  ) {
    return callback(null, true);
  }

  const error = new Error(
    "Only JPEG, PNG, WebP, GIF and AVIF images are allowed"
  );

  error.statusCode = 400;

  return callback(error, false);
};

const upload = multer({
  storage:
    multer.memoryStorage(),

  limits: {
    fileSize:
      MAX_FILE_SIZE_MB *
      1024 *
      1024,

    files: 1,
  },

  fileFilter,
});

// Single image under the "image" form field
const uploadSingleImage =
  upload.single("image");

module.exports = {
  upload,
  uploadSingleImage,
  MAX_FILE_SIZE_MB,
};
