const express = require("express");

const {
  createPaymentOrder,
  verifyPayment,
} = require("../controllers/payment.controller");

const {
  protect,
} = require("../middleware/auth.middleware");

const router = express.Router();

// All payment APIs require login
router.use(protect);

// Create Razorpay order
router.post(
  "/create-order",
  createPaymentOrder
);

// Verify payment
router.post(
  "/verify",
  verifyPayment
);

module.exports = router;