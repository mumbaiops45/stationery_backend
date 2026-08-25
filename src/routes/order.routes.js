const express = require("express");

const {
  getMyOrders,
  getMyOrder,
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

module.exports = router;