const express = require("express");

const {
  getCategories,
  getCategoryById,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  updateCategoryStatus,
  deleteCategory,
  getAdminCategories,
} = require("../controllers/category.controller");

const {
  protect,
  adminOnly,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ======================================================
// PUBLIC
// ======================================================

router.get(
  "/",
  getCategories
);

router.get(
  "/slug/:slug",
  getCategoryBySlug
);

router.get(
  "/:id",
  getCategoryById
);

// ======================================================
// ADMIN
// ======================================================

// Admin category list
// Search + filter + sort + pagination
router.get(
  "/admin/all",
  protect,
  adminOnly,
  getAdminCategories
);

// ======================================================
// ADMIN
// ======================================================

router.post(
  "/",
  protect,
  adminOnly,
  createCategory
);

router.put(
  "/:id",
  protect,
  adminOnly,
  updateCategory
);

router.patch(
  "/:id/status",
  protect,
  adminOnly,
  updateCategoryStatus
);

router.delete(
  "/:id",
  protect,
  adminOnly,
  deleteCategory
);

module.exports = router;