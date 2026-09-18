const express = require("express");

const {
  getAdminOrders,
  getAdminOrder,
  updateOrderStatus,
  retryShiprocket,
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

// Retry a failed (or not-yet-attempted) Shiprocket push
router.post(
  "/:id/retry-shiprocket",
  retryShiprocket
);

module.exports = router;