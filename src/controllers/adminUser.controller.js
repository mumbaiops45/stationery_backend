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


const mongoose = require("mongoose");
const User = require("../models/User");

// ======================================================
// GET ALL USERS - ADMIN
// Search + Role + Status + Sort + Pagination
// ======================================================

const getAdminUsers = async (
  req,
  res,
  next
) => {
  try {
    const {
      search = "",
      role = "all",
      status = "all",
      sort = "newest",
      page = 1,
      limit = 20,
    } = req.query;

    // --------------------------------------------------
    // PAGINATION
    // --------------------------------------------------

    const currentPage = Math.max(
      Number(page) || 1,
      1
    );

    const perPage = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const skip =
      (currentPage - 1) * perPage;

    // --------------------------------------------------
    // FILTER
    // --------------------------------------------------

    const filter = {};

    // Role
    if (role !== "all") {
      if (
        !["customer", "admin"].includes(
          role
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid role",
        });
      }

      filter.role = role;
    }

    // Status
    if (status === "active") {
      filter.isActive = true;
    }

    if (status === "inactive") {
      filter.isActive = false;
    }

    // Search
    if (search.trim()) {
      filter.$or = [
        {
          name: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          email: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          phone: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    // --------------------------------------------------
    // SORT
    // --------------------------------------------------

    const sortOption =
      sort === "oldest"
        ? { createdAt: 1 }
        : { createdAt: -1 };

    // --------------------------------------------------
    // GET USERS
    // --------------------------------------------------

    const [
      users,
      totalUsers,
    ] = await Promise.all([
      User.find(filter)
        .select(
          "-password -resetPasswordTokenHash -resetPasswordExpiresAt -emailVerificationTokenHash -emailVerificationExpiresAt"
        )
        .sort(sortOption)
        .skip(skip)
        .limit(perPage)
        .lean(),

      User.countDocuments(filter),
    ]);

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      data: {
        users,

        pagination: {
          page: currentPage,
          limit: perPage,
          totalUsers,
          totalPages: Math.ceil(
            totalUsers / perPage
          ),
        },

        filters: {
          search: search.trim(),
          role,
          status,
          sort,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  updateUserRole,
  getAdminUsers,
};