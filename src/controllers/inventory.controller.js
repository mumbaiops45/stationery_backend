const mongoose = require("mongoose");

const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");

// ======================================================
// GET ALL INVENTORY
// ======================================================

const getInventory = async (
  req,
  res,
  next
) => {
  try {
    const products =
      await Product.find({})
        .populate(
          "category",
          "name slug"
        )
        .select(
          "name category price stock hasVariants isActive"
        )
        .sort({
          createdAt: -1,
        })
        .lean();

    const variants =
      await ProductVariant.find({})
        .populate(
          "product",
          "name"
        )
        .select(
          "product name price stock attributes isActive"
        )
        .sort({
          createdAt: -1,
        })
        .lean();

    return res.status(200).json({
      success: true,
      data: {
        products,
        variants,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET SIMPLE PRODUCT INVENTORY
// ======================================================

const getProductInventory = async (
  req,
  res,
  next
) => {
  try {
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

    const product =
      await Product.findById(
        productId
      )
        .populate(
          "category",
          "name slug"
        )
        .select(
          "name category price stock hasVariants isActive"
        )
        .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        inventory: {
          productId:
            product._id,
          name:
            product.name,
          stock:
            product.stock,
          hasVariants:
            product.hasVariants,
          isActive:
            product.isActive,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET VARIANT INVENTORY
// ======================================================

const getVariantInventory = async (
  req,
  res,
  next
) => {
  try {
    const { variantId } =
      req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        variantId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid variant ID",
      });
    }

    const variant =
      await ProductVariant.findById(
        variantId
      )
        .populate(
          "product",
          "name"
        )
        .lean();

    if (!variant) {
      return res.status(404).json({
        success: false,
        message:
          "Variant not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        inventory: {
          variantId:
            variant._id,
          product:
            variant.product,
          name:
            variant.name,
          stock:
            variant.stock,
          isActive:
            variant.isActive,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE SIMPLE PRODUCT STOCK
// ======================================================

const updateProductStock = async (
  req,
  res,
  next
) => {
  try {
    const { productId } =
      req.params;

    const {
      stock,
    } = req.body;

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

    if (
      stock === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Stock is required",
      });
    }

    const newStock =
      Number(stock);

    if (
      Number.isNaN(newStock) ||
      newStock < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Stock must be a valid number greater than or equal to 0",
      });
    }

    const product =
      await Product.findById(
        productId
      );

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found",
      });
    }

    // Do not directly manage parent stock
    // when the product has variants.
    if (product.hasVariants) {
      return res.status(400).json({
        success: false,
        message:
          "This product has variants. Update variant stock instead.",
      });
    }

    product.stock =
      newStock;

    await product.save();

    return res.status(200).json({
      success: true,
      message:
        "Product stock updated successfully",
      data: {
        inventory: {
          productId:
            product._id,
          productName:
            product.name,
          stock:
            product.stock,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE VARIANT STOCK
// ======================================================

const updateVariantStock = async (
  req,
  res,
  next
) => {
  try {
    const { variantId } =
      req.params;

    const {
      stock,
    } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(
        variantId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid variant ID",
      });
    }

    if (
      stock === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Stock is required",
      });
    }

    const newStock =
      Number(stock);

    if (
      Number.isNaN(newStock) ||
      newStock < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Stock must be a valid number greater than or equal to 0",
      });
    }

    const variant =
      await ProductVariant.findById(
        variantId
      ).populate(
        "product",
        "name"
      );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message:
          "Variant not found",
      });
    }

    variant.stock =
      newStock;

    await variant.save();

    return res.status(200).json({
      success: true,
      message:
        "Variant stock updated successfully",
      data: {
        inventory: {
          variantId:
            variant._id,
          product:
            variant.product,
          variantName:
            variant.name,
          stock:
            variant.stock,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInventory,
  getProductInventory,
  getVariantInventory,
  updateProductStock,
  updateVariantStock,
};