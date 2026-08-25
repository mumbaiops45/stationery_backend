const express = require("express");

const {
  getProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  updateProductStatus,
  deleteProduct,
  getAdminProducts,
} = require("../controllers/product.controller");

const {
  protect,
  adminOnly,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ======================================================
// PUBLIC PRODUCT ROUTES
// ======================================================

// Search + filter + sort + pagination
router.get(
  "/",
  getProducts
);

// Product by slug
router.get(
  "/slug/:slug",
  getProductBySlug
);

// Product by ID
router.get(
  "/:id",
  getProductById
);

// ======================================================
// ADMIN PRODUCT ROUTES
// ======================================================

// Admin get all products
router.get(
  "/admin/all",
  protect,
  adminOnly,
  getAdminProducts
);

// Create product
router.post(
  "/",
  protect,
  adminOnly,
  createProduct
);

// Update product
router.put(
  "/:id",
  protect,
  adminOnly,
  updateProduct
);

// Update product status
router.patch(
  "/:id/status",
  protect,
  adminOnly,
  updateProductStatus
);

// Delete product
router.delete(
  "/:id",
  protect,
  adminOnly,
  deleteProduct
);

module.exports = router;