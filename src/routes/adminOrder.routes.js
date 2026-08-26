const express = require("express");

const {
  getAdminOrders,
} = require("../controllers/order.controller");

const {
  protect,
  adminOnly,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ======================================================
// ADMIN ORDERS
// ======================================================

router.use(protect);
router.use(adminOnly);

// Get all orders
router.get(
  "/",
  getAdminOrders
);

module.exports = router;