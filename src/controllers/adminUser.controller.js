const mongoose = require("mongoose");
const User = require("../models/User");

// ======================================================
// UPDATE USER ROLE
// ======================================================

const updateUserRole = async (
  req,
  res,
  next
) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Validate user ID
    if (
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Validate role
    if (
      !["customer", "admin"].includes(role)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Role must be customer or admin",
      });
    }

    // Find user
    const user =
      await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Don't allow admin to change their own role
    if (
      user._id.toString() ===
      req.user.userId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot change your own role",
      });
    }

    user.role = role;

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "User role updated successfully",
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
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateUserRole,
};