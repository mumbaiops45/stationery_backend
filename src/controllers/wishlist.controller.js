const mongoose = require("mongoose");

const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");

// ======================================================
// GET MY WISHLIST
// ======================================================

const getWishlist = async (
  req,
  res,
  next
) => {
  try {
    const userId =
      req.user.userId;

    let wishlist =
      await Wishlist.findOne({
        user: userId,
      })
        .populate({
          path: "products",
          match: {
            isActive: true,
          },
          populate: {
            path: "category",
            select: "name slug",
          },
        })
        .lean();

    // If user has no wishlist yet
    if (!wishlist) {
      return res.status(200).json({
        success: true,
        data: {
          wishlist: {
            products: [],
          },
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        wishlist: {
          id: wishlist._id,
          products:
            wishlist.products || [],
          totalItems:
            wishlist.products
              ? wishlist.products.length
              : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// ADD PRODUCT TO WISHLIST
// ======================================================

const addToWishlist = async (
  req,
  res,
  next
) => {
  try {
    const userId =
      req.user.userId;

    const { productId } =
      req.params;

    // Validate product ID
    if (
      !mongoose.Types.ObjectId.isValid(
        productId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid product ID",
      });
    }

    // Check product
    const product =
      await Product.findOne({
        _id: productId,
        isActive: true,
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found",
      });
    }

    // Find existing wishlist
    let wishlist =
      await Wishlist.findOne({
        user: userId,
      });

    // Create wishlist if needed
    if (!wishlist) {
      wishlist =
        await Wishlist.create({
          user: userId,
          products: [
            productId,
          ],
        });

      return res.status(201).json({
        success: true,
        message:
          "Product added to wishlist",
        data: {
          wishlist,
        },
      });
    }

    // Check duplicate
    const alreadyExists =
      wishlist.products.some(
        (id) =>
          id.toString() ===
          productId
      );

    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message:
          "Product is already in your wishlist",
      });
    }

    wishlist.products.push(
      productId
    );

    await wishlist.save();

    return res.status(200).json({
      success: true,
      message:
        "Product added to wishlist",
      data: {
        wishlist,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// CHECK PRODUCT IN WISHLIST
// ======================================================

const checkWishlist = async (
  req,
  res,
  next
) => {
  try {
    const userId =
      req.user.userId;

    const { productId } =
      req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        productId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid product ID",
      });
    }

    const wishlist =
      await Wishlist.findOne({
        user: userId,
        products: productId,
      });

    return res.status(200).json({
      success: true,
      data: {
        isWishlisted:
          !!wishlist,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// REMOVE PRODUCT FROM WISHLIST
// ======================================================

const removeFromWishlist =
  async (
    req,
    res,
    next
  ) => {
    try {
      const userId =
        req.user.userId;

      const { productId } =
        req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          productId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid product ID",
        });
      }

      const wishlist =
        await Wishlist.findOne({
          user: userId,
        });

      if (!wishlist) {
        return res.status(404).json({
          success: false,
          message:
            "Wishlist not found",
        });
      }

      const originalLength =
        wishlist.products.length;

      wishlist.products =
        wishlist.products.filter(
          (id) =>
            id.toString() !==
            productId
        );

      if (
        wishlist.products.length ===
        originalLength
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Product is not in your wishlist",
        });
      }

      await wishlist.save();

      return res.status(200).json({
        success: true,
        message:
          "Product removed from wishlist",
        data: {
          wishlist,
        },
      });
    } catch (error) {
      next(error);
    }
  };

// ======================================================
// CLEAR WISHLIST
// ======================================================

const clearWishlist = async (
  req,
  res,
  next
) => {
  try {
    const userId =
      req.user.userId;

    const wishlist =
      await Wishlist.findOne({
        user: userId,
      });

    if (!wishlist) {
      return res.status(200).json({
        success: true,
        message:
          "Wishlist is already empty",
      });
    }

    wishlist.products = [];

    await wishlist.save();

    return res.status(200).json({
      success: true,
      message:
        "Wishlist cleared successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  checkWishlist,
  removeFromWishlist,
  clearWishlist,
};