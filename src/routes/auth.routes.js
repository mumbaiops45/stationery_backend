const express = require("express");

const {
    register,
    login,
    refresh,
    logout,
    logoutAll,
    me,
    forgotPassword,
    resetPassword,
    changePassword,
    sendVerificationEmail,
    verifyEmail,
} = require("../controllers/auth.controller");

const {
    protect,
} = require("../middleware/auth.middleware");

const router = express.Router();

// ======================================================
// PUBLIC AUTH ROUTES
// ======================================================

// Register
router.post(
    "/register",
    register
);

// Login
router.post(
    "/login",
    login
);
router.post(
  "/send-verification",
  protect,
  sendVerificationEmail
);
router.post(
  "/verify-email",
  verifyEmail
);

// Refresh access token
router.post(
    "/refresh",
    refresh
);

// Logout
router.post(
    "/logout",
    logout
);

// Forgot password
router.post(
    "/forgot-password",
    forgotPassword
);

// Reset password
router.post(
    "/reset-password",
    resetPassword
);

// ======================================================
// PROTECTED AUTH ROUTES
// ======================================================

// Get current logged-in user
router.get(
    "/me",
    protect,
    me
);

// Logout from all devices
router.post(
    "/logout-all",
    protect,
    logoutAll
);

router.patch(
    "/change-password",
    protect,
    changePassword
);
module.exports = router;