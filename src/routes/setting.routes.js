const express = require("express");

const {
  getShippingSettings,
  updateShippingSettings,
  getGiftSettings,
  updateGiftSettings,
} = require("../controllers/setting.controller");

const {
  protect,
  adminOnly,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ======================================================
// ADMIN
// ======================================================

router.get(
  "/shipping",
  protect,
  adminOnly,
  getShippingSettings
);

router.put(
  "/shipping",
  protect,
  adminOnly,
  updateShippingSettings
);

router.get(
  "/gift",
  protect,
  adminOnly,
  getGiftSettings
);

router.put(
  "/gift",
  protect,
  adminOnly,
  updateGiftSettings
);

module.exports = router;
