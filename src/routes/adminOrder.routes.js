const express = require("express");

const {
  getAdminOrders,
  getAdminOrder,
  updateOrderStatus,
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

// Get one order
router.get(
  "/:id",
  getAdminOrder
);

// Move an order through its lifecycle
router.patch(
  "/:id/status",
  updateOrderStatus
);

module.exports = router;