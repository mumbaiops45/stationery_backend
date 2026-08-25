const express = require("express");

const {
  getAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
} = require("../controllers/address.controller");

const {
  protect,
} = require("../middleware/auth.middleware");

const router = express.Router();

// All address APIs require login
router.use(protect);

// Get all addresses
router.get(
  "/",
  getAddresses
);

// Get one address
router.get(
  "/:id",
  getAddressById
);

// Add address
router.post(
  "/",
  createAddress
);

// Update address
router.put(
  "/:id",
  updateAddress
);

// Set default
router.patch(
  "/:id/default",
  setDefaultAddress
);

// Delete address
router.delete(
  "/:id",
  deleteAddress
);

module.exports = router;