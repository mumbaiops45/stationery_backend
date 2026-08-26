const express = require("express");

const {
  getDashboard,
} = require(
  "../controllers/adminDashboard.controller"
);

const {
  protect,
  adminOnly,
} = require(
  "../middleware/auth.middleware"
);

const router = express.Router();

// ======================================================
// ADMIN DASHBOARD
// ======================================================

router.get(
  "/",
  protect,
  adminOnly,
  getDashboard
);

module.exports = router;