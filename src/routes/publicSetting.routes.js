const express = require("express");

const {
  getShippingSettings,
} = require("../controllers/setting.controller");

const router = express.Router();

// ======================================================
// PUBLIC
//
// The storefront needs these numbers before a customer is
// authenticated at all (cart drawer, product page, FAQ
// copy), so this mirrors GET /api/admin/settings/shipping
// with no auth. Same handler, same two read-only fields -
// nothing here can be written to.
// ======================================================

router.get(
  "/shipping",
  getShippingSettings
);

module.exports = router;
