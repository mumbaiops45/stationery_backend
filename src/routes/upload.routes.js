const express = require("express");

const {
  uploadImage,
  deleteImage,
} = require("../controllers/upload.controller");

const {
  uploadSingleImage,
} = require("../middleware/upload.middleware");

const {
  protect,
  adminOnly,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ======================================================
// UPLOAD ROUTES - ADMIN ONLY
// ======================================================

router.use(protect);
router.use(adminOnly);

// Upload a single image
router.post(
  "/image",
  uploadSingleImage,
  uploadImage
);

// Delete an image by publicId
router.delete(
  "/image",
  deleteImage
);

module.exports = router;
