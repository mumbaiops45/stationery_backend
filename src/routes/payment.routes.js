const express = require("express");

const {
  createPaymentOrder,
  verifyPayment,
  razorpayWebhook,
} = require("../controllers/payment.controller");

const {
  protect,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ======================================================
// WEBHOOK
//
// Razorpay is a server, not a logged-in user, so this is
// declared before router.use(protect). It authenticates
// with a signature instead of a token.
// ======================================================

router.post(
  "/webhook",
  razorpayWebhook
);

// Every route below requires login
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