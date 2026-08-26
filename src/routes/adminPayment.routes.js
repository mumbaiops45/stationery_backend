const express = require("express");

const {
  getAdminPayments,
  getAdminPaymentById,
} = require(
  "../controllers/payment.controller"
);

const {
  protect,
  adminOnly,
} = require(
  "../middleware/auth.middleware"
);

const router = express.Router();

// ======================================================
// ADMIN PAYMENT ROUTES
// ======================================================

router.use(protect);
router.use(adminOnly);

// Get all payments
router.get(
  "/",
  getAdminPayments
);

// Get payment details
router.get(
  "/:id",
  getAdminPaymentById
);

module.exports = router;