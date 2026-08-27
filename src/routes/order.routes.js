const express = require("express");

const {
  getMyOrders,
  getMyOrder,
  placeCodOrder,
  cancelMyOrder,
} = require("../controllers/order.controller");

const {
  protect,
} = require("../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router.get(
  "/",
  getMyOrders
);

router.get(
  "/:id",
  getMyOrder
);

// Place a cash-on-delivery order.
// The online route is POST /api/payment/create-order.
router.post(
  "/",
  placeCodOrder
);

// Cancel an order (before dispatch only)
router.patch(
  "/:id/cancel",
  cancelMyOrder
);

module.exports = router;