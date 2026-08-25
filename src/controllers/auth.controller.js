const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");

const {
  generateAccessToken,
} = require("../utils/jwt");
const {
  generateVerificationToken,
  hashVerificationToken,
} = require("../utils/emailVerification");

const {
  generateRefreshToken,
  hashRefreshToken,
  generateFamilyId,
} = require("../utils/refreshToken");

const {
  generateResetToken,
  hashResetToken,
} = require("../utils/passwordReset");

const REFRESH_COOKIE_NAME = "refreshToken";

// ======================================================
// REFRESH TOKEN HELPERS
// ======================================================

const getRefreshExpiry = () => {
  const days = Number(
    process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || 7
  );

  return new Date(
    Date.now() +
      days * 24 * 60 * 60 * 1000
  );
};

const setRefreshCookie = (res, token) => {
  const isProduction =
    process.env.NODE_ENV === "production";

  res.cookie(
    REFRESH_COOKIE_NAME,
    token,
    {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction
        ? "none"
        : "lax",
      path: "/api/auth",
      maxAge:
        Number(
          process.env
            .REFRESH_TOKEN_EXPIRES_IN_DAYS ||
            7
        ) *
        24 *
        60 *
        60 *
        1000,
    }
  );
};

const clearRefreshCookie = (res) => {
  const isProduction =
    process.env.NODE_ENV === "production";

  res.clearCookie(
    REFRESH_COOKIE_NAME,
    {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction
        ? "none"
        : "lax",
      path: "/api/auth",
    }
  );
};

// ======================================================
// REGISTER
// ======================================================

const register = async (
  req,
  res,
  next
) => {
  try {
    const {
      name,
      email,
      phone,
      password,
    } = req.body;

    if (
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and password are required",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const existingUser =
      await User.findOne({
        email: normalizedEmail,
      });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists",
      });
    }

    const user =
      await User.create({
        name,
        email: normalizedEmail,
        phone,
        password,
      });

    const accessToken =
      generateAccessToken(user);

    const refreshToken =
      generateRefreshToken();

    const tokenHash =
      hashRefreshToken(
        refreshToken
      );

    await RefreshToken.create({
      user: user._id,
      tokenHash,
      familyId:
        generateFamilyId(),
      expiresAt:
        getRefreshExpiry(),
    });

    setRefreshCookie(
      res,
      refreshToken
    );

    return res.status(201).json({
      success: true,
      message:
        "Account created successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isVerified:
            user.isVerified,
        },
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};


// ======================================================
// SEND EMAIL VERIFICATION
// ======================================================

const sendVerificationEmail = async (
  req,
  res,
  next
) => {
  try {
    const user =
      await User.findById(
        req.user.userId
      ).select(
        "+emailVerificationTokenHash +emailVerificationExpiresAt"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "Your account has been disabled",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message:
          "Email is already verified",
      });
    }

    const verificationToken =
      generateVerificationToken();

    const verificationTokenHash =
      hashVerificationToken(
        verificationToken
      );

    user.emailVerificationTokenHash =
      verificationTokenHash;

    user.emailVerificationExpiresAt =
      new Date(
        Date.now() +
          15 * 60 * 1000
      );

    await user.save({
      validateBeforeSave: false,
    });

    // Development only
    console.log(
      "EMAIL VERIFICATION TOKEN:",
      verificationToken
    );

    return res.status(200).json({
      success: true,
      message:
        "Verification link has been generated",
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// VERIFY EMAIL
// ======================================================

const verifyEmail = async (
  req,
  res,
  next
) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message:
          "Verification token is required",
      });
    }

    const tokenHash =
      hashVerificationToken(token);

    const user =
      await User.findOne({
        emailVerificationTokenHash:
          tokenHash,

        emailVerificationExpiresAt: {
          $gt: new Date(),
        },
      }).select(
        "+emailVerificationTokenHash +emailVerificationExpiresAt"
      );

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired verification token",
      });
    }

    user.isVerified = true;

    user.emailVerificationTokenHash =
      null;

    user.emailVerificationExpiresAt =
      null;

    await user.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      success: true,
      message:
        "Email verified successfully",
    });
  } catch (error) {
    next(error);
  }
};
// ======================================================
// LOGIN
// ======================================================

const login = async (
  req,
  res,
  next
) => {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const user =
      await User.findOne({
        email: normalizedEmail,
      }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "Your account has been disabled",
      });
    }

    const isPasswordCorrect =
      await user.comparePassword(
        password
      );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    const accessToken =
      generateAccessToken(user);

    const refreshToken =
      generateRefreshToken();

    const tokenHash =
      hashRefreshToken(
        refreshToken
      );

    await RefreshToken.create({
      user: user._id,
      tokenHash,
      familyId:
        generateFamilyId(),
      expiresAt:
        getRefreshExpiry(),
    });

    setRefreshCookie(
      res,
      refreshToken
    );

    return res.status(200).json({
      success: true,
      message:
        "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isVerified:
            user.isVerified,
        },
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// REFRESH
// ======================================================

const refresh = async (
  req,
  res,
  next
) => {
  try {
    const oldRefreshToken =
      req.cookies[
        REFRESH_COOKIE_NAME
      ];

    if (!oldRefreshToken) {
      return res.status(401).json({
        success: false,
        message:
          "Refresh token is missing",
      });
    }

    const oldTokenHash =
      hashRefreshToken(
        oldRefreshToken
      );

    const storedToken =
      await RefreshToken.findOne({
        tokenHash: oldTokenHash,
      });

    if (!storedToken) {
      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message:
          "Invalid refresh token",
      });
    }

    // Refresh token reuse detection
    if (storedToken.revokedAt) {
      await RefreshToken.updateMany(
        {
          familyId:
            storedToken.familyId,
          revokedAt: null,
        },
        {
          $set: {
            revokedAt:
              new Date(),
          },
        }
      );

      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message:
          "Refresh token reuse detected. Please login again.",
      });
    }

    // Expired refresh token
    if (
      storedToken.expiresAt <=
      new Date()
    ) {
      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message:
          "Refresh token has expired",
      });
    }

    const user =
      await User.findById(
        storedToken.user
      );

    if (!user || !user.isActive) {
      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message:
          "User account is unavailable",
      });
    }

    // Revoke old refresh token
    storedToken.revokedAt =
      new Date();

    await storedToken.save();

    // Generate new refresh token
    const newRefreshToken =
      generateRefreshToken();

    const newTokenHash =
      hashRefreshToken(
        newRefreshToken
      );

    await RefreshToken.create({
      user: user._id,
      tokenHash: newTokenHash,
      familyId:
        storedToken.familyId,
      expiresAt:
        getRefreshExpiry(),
    });

    // Generate new access token
    const accessToken =
      generateAccessToken(user);

    setRefreshCookie(
      res,
      newRefreshToken
    );

    return res.status(200).json({
      success: true,
      message:
        "Token refreshed successfully",
      data: {
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// LOGOUT
// ======================================================

const logout = async (
  req,
  res,
  next
) => {
  try {
    const refreshToken =
      req.cookies[
        REFRESH_COOKIE_NAME
      ];

    if (refreshToken) {
      const tokenHash =
        hashRefreshToken(
          refreshToken
        );

      await RefreshToken.findOneAndUpdate(
        {
          tokenHash,
          revokedAt: null,
        },
        {
          $set: {
            revokedAt:
              new Date(),
          },
        }
      );
    }

    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message:
        "Logout successful",
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// LOGOUT ALL DEVICES
// ======================================================

const logoutAll = async (
  req,
  res,
  next
) => {
  try {
    await RefreshToken.updateMany(
      {
        user:
          req.user.userId,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt:
            new Date(),
        },
      }
    );

    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message:
        "Logged out from all devices",
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// CURRENT USER
// ======================================================

const me = async (
  req,
  res,
  next
) => {
  try {
    const user =
      await User.findById(
        req.user.userId
      ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// FORGOT PASSWORD
// ======================================================

const forgotPassword = async (
  req,
  res,
  next
) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message:
          "Email is required",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const user =
      await User.findOne({
        email: normalizedEmail,
      });

    // Don't reveal whether email exists
    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If an account exists with this email, a password reset link has been sent.",
      });
    }

    const resetToken =
      generateResetToken();

    const resetTokenHash =
      hashResetToken(
        resetToken
      );

    user.resetPasswordTokenHash =
      resetTokenHash;

    user.resetPasswordExpiresAt =
      new Date(
        Date.now() +
          15 * 60 * 1000
      );

    await user.save({
      validateBeforeSave: false,
    });

    // Development only
    console.log(
      "PASSWORD RESET TOKEN:",
      resetToken
    );

    return res.status(200).json({
      success: true,
      message:
        "If an account exists with this email, a password reset link has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// RESET PASSWORD
// ======================================================

const resetPassword = async (
  req,
  res,
  next
) => {
  try {
    const {
      token,
      password,
    } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Token and new password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters",
      });
    }

    const tokenHash =
      hashResetToken(token);

    const user =
      await User.findOne({
        resetPasswordTokenHash:
          tokenHash,

        resetPasswordExpiresAt: {
          $gt: new Date(),
        },
      }).select(
        "+resetPasswordTokenHash +resetPasswordExpiresAt"
      );

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired password reset token",
      });
    }

    // Change password
    user.password =
      password;

    // Remove reset token
    user.resetPasswordTokenHash =
      null;

    user.resetPasswordExpiresAt =
      null;

    await user.save();

    // Revoke all existing refresh sessions
    await RefreshToken.updateMany(
      {
        user: user._id,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt:
            new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully. Please login again.",
    });
  } catch (error) {
    next(error);
  }
};
// ======================================================
// CHANGE PASSWORD
// ======================================================

const changePassword = async (
  req,
  res,
  next
) => {
  try {
    const {
      currentPassword,
      newPassword,
    } = req.body;

    if (
      !currentPassword ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be at least 8 characters",
      });
    }

    // Get user with password
    const user =
      await User.findById(
        req.user.userId
      ).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "Your account has been disabled",
      });
    }

    // Check current password
    const isCurrentPasswordCorrect =
      await user.comparePassword(
        currentPassword
      );

    if (!isCurrentPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message:
          "Current password is incorrect",
      });
    }

    // Prevent using same password
    const isSamePassword =
      await user.comparePassword(
        newPassword
      );

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be different from current password",
      });
    }

    // Update password
    user.password = newPassword;

    await user.save();

    // Revoke all existing refresh tokens
    await RefreshToken.updateMany(
      {
        user: user._id,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
        },
      }
    );

    // Clear current refresh cookie
    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message:
        "Password changed successfully. Please login again.",
    });
  } catch (error) {
    next(error);
  }
};
// ======================================================
// EXPORTS
// ======================================================

module.exports = {
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
};