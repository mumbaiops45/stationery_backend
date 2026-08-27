const express = require("express");

const {
  getAdminUsers,
  getAdminUser,
  updateUserRole,
  updateUserStatus,
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

// Suspend or reactivate an account
router.patch(
  "/:userId/status",
  updateUserStatus
);

// Get one user with their order summary
// Declared last so it does not shadow the routes above
router.get(
  "/:userId",
  getAdminUser
);

module.exports = router;