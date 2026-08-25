const express = require("express");

const {
  getCheckout,
} = require("../controllers/checkout.controller");

const {
  protect,
} = require("../middleware/auth.middleware");

const router = express.Router();

// All checkout APIs require login
router.use(protect);

// Checkout preview
router.post(
  "/",
  getCheckout
);

module.exports = router;