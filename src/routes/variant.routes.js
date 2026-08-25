const express = require("express");

const {
  getProductVariants,
  getVariantById,
  createVariant,
  updateVariant,
  updateVariantStatus,
  deleteVariant,
} = require("../controllers/variant.controller");

const {
  protect,
  adminOnly,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ======================================================
// PUBLIC
// ======================================================

router.get(
  "/products/:productId/variants",
  getProductVariants
);

router.get(
  "/products/:productId/variants/:variantId",
  getVariantById
);

// ======================================================
// ADMIN
// ======================================================

router.post(
  "/products/:productId/variants",
  protect,
  adminOnly,
  createVariant
);

router.put(
  "/products/:productId/variants/:variantId",
  protect,
  adminOnly,
  updateVariant
);

router.patch(
  "/products/:productId/variants/:variantId/status",
  protect,
  adminOnly,
  updateVariantStatus
);

router.delete(
  "/products/:productId/variants/:variantId",
  protect,
  adminOnly,
  deleteVariant
);

module.exports = router;