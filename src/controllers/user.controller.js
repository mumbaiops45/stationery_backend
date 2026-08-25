const User = require("../models/User");

// ======================================================
// GET MY PROFILE
// ======================================================

const getMyProfile = async (
  req,
  res,
  next
) => {
  try {
    const user = await User.findById(
      req.user.userId
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
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
// UPDATE MY PROFILE
// ======================================================

const updateMyProfile = async (
  req,
  res,
  next
) => {
  try {
    const {
      name,
      phone,
    } = req.body;

    const user = await User.findById(
      req.user.userId
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

    // Update name
    if (name !== undefined) {
      const trimmedName =
        name.trim();

      if (trimmedName.length < 2) {
        return res.status(400).json({
          success: false,
          message:
            "Name must be at least 2 characters",
        });
      }

      if (trimmedName.length > 100) {
        return res.status(400).json({
          success: false,
          message:
            "Name cannot exceed 100 characters",
        });
      }

      user.name = trimmedName;
    }

    // Update phone
    if (phone !== undefined) {
      user.phone =
        phone.trim();
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isVerified:
            user.isVerified,
          isActive:
            user.isActive,
          createdAt:
            user.createdAt,
          updatedAt:
            user.updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
};