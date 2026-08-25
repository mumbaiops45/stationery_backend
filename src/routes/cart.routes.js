const express = require("express");

const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} = require("../controllers/cart.controller");

const {
  protect,
} = require("../middleware/auth.middleware");

const router = express.Router();

// All cart APIs require login
router.use(protect);

// Get cart
router.get(
  "/",
  getCart
);

// Add product/variant
router.post(
  "/",
  addToCart
);

// Update quantity
router.patch(
  "/item/:itemId",
  updateCartItem
);

// Remove item
router.delete(
  "/item/:itemId",
  removeCartItem
);

// Clear cart
router.delete(
  "/",
  clearCart
);

module.exports = router;