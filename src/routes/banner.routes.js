const express = require("express");

const {
  getBanners,
  getAdminBanners,
  getBannerById,
  createBanner,
  updateBanner,
  updateBannerStatus,
  reorderBanners,
  deleteBanner,
} = require("../controllers/banner.controller");

const {
  protect,
  adminOnly,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ======================================================
// PUBLIC
// ======================================================

// GET /api/banners?type=homepage | offer
router.get(
  "/",
  getBanners
);

// ======================================================
// ADMIN
// ======================================================

// Admin banner list
// Search + type + status + sort + pagination
router.get(
  "/admin/all",
  protect,
  adminOnly,
  getAdminBanners
);

router.patch(
  "/admin/reorder",
  protect,
  adminOnly,
  reorderBanners
);

router.get(
  "/:id",
  protect,
  adminOnly,
  getBannerById
);

router.post(
  "/",
  protect,
  adminOnly,
  createBanner
);

router.put(
  "/:id",
  protect,
  adminOnly,
  updateBanner
);

router.patch(
  "/:id/status",
  protect,
  adminOnly,
  updateBannerStatus
);

router.delete(
  "/:id",
  protect,
  adminOnly,
  deleteBanner
);

module.exports = router;
