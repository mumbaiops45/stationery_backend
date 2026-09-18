const express = require("express");

const {
  getShippingSettings,
  getGiftSettings,
} = require("../controllers/setting.controller");

const router = express.Router();

// ======================================================
// PUBLIC
//
// The storefront needs these numbers before a customer is
// authenticated at all (cart drawer, product page, FAQ
// copy), so this mirrors the admin routes with no auth -
// same handlers, same read-only data. Nothing here can be
// written to, and none of it is sensitive: it is literally
// what the storefront shows customers anyway.
// ======================================================

router.get(
  "/shipping",
  getShippingSettings
);

router.get(
  "/gift",
  getGiftSettings
);

module.exports = router;
