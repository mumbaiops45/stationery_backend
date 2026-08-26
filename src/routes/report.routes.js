const express = require("express");

const {
  getOverviewReport,
} = require(
  "../controllers/report.controller"
);

const {
  protect,
  adminOnly,
} = require(
  "../middleware/auth.middleware"
);

const router = express.Router();

// ======================================================
// ADMIN REPORTS
// ======================================================

router.use(protect);
router.use(adminOnly);

// Overview report
router.get(
  "/overview",
  getOverviewReport
);

module.exports = router;