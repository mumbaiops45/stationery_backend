const express = require("express");

const {
  getMyOrders,
  getMyOrder,
  getCancelReasons,
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

// The cancellation dropdown. Declared before "/:id" or
// Express would read "cancel-reasons" as an order id.
router.get(
  "/cancel-reasons",
  getCancelReasons
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