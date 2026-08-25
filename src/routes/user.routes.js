const express = require("express");

const {
  getMyProfile,
  updateMyProfile,
} = require("../controllers/user.controller");

const {
  protect,
} = require("../middleware/auth.middleware");

const router = express.Router();

// Every user profile route requires login
router.use(protect);

// Get my profile
router.get(
  "/profile",
  getMyProfile
);

// Update my profile
router.put(
  "/profile",
  updateMyProfile
);

module.exports = router;