const express = require("express");

const {
  getAdminUsers,
  updateUserRole,
} = require("../controllers/adminUser.controller");

const {
  protect,
  adminOnly,
} = require("../middleware/auth.middleware");

const router = express.Router();

// All admin user APIs require:
// 1. Login
// 2. Admin role
router.use(protect);
router.use(adminOnly);


// ======================================================
// GET ALL USERS
// ======================================================

router.get(
  "/",
  getAdminUsers
);
// Update user role
router.patch(
  "/:userId/role",
  updateUserRole
);

module.exports = router;