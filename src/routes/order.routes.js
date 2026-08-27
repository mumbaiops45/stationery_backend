const express = require("express");

const {
  getMyOrders,
  getMyOrder,
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

// Cancel an order (before dispatch only)
router.patch(
  "/:id/cancel",
  cancelMyOrder
);

module.exports = router;