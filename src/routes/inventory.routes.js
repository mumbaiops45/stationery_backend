const express = require("express");

const {
  getInventory,
  getProductInventory,
  getVariantInventory,
  updateProductStock,
  updateVariantStock,
} = require("../controllers/inventory.controller");

const {
  protect,
  adminOnly,
} = require("../middleware/auth.middleware");

const router = express.Router();

// All inventory APIs are admin-only
router.use(protect);
router.use(adminOnly);

// Get complete inventory
router.get(
  "/",
  getInventory
);

// Get product stock
router.get(
  "/product/:productId",
  getProductInventory
);

// Get variant stock
router.get(
  "/variant/:variantId",
  getVariantInventory
);

// Update simple product stock
router.patch(
  "/product/:productId",
  updateProductStock
);

// Update variant stock
router.patch(
  "/variant/:variantId",
  updateVariantStock
);

module.exports = router;