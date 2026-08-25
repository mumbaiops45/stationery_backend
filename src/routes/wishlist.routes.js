const express = require("express");

const {
  getWishlist,
  addToWishlist,
  checkWishlist,
  removeFromWishlist,
  clearWishlist,
} = require("../controllers/wishlist.controller");

const {
  protect,
} = require("../middleware/auth.middleware");

const router = express.Router();

// All wishlist APIs require login
router.use(protect);

// Get wishlist
router.get(
  "/",
  getWishlist
);

// Add product
router.post(
  "/:productId",
  addToWishlist
);

// Check product
router.get(
  "/:productId",
  checkWishlist
);

// Remove product
router.delete(
  "/:productId",
  removeFromWishlist
);

// Clear wishlist
router.delete(
  "/",
  clearWishlist
);

module.exports = router;