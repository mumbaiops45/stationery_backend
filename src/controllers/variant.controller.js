const mongoose = require("mongoose");

const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");

// ======================================================
// GET PRODUCT VARIANTS - PUBLIC
// ======================================================

const getProductVariants = async (
  req,
  res,
  next
) => {
  try {
    const { productId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      isActive: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const variants =
      await ProductVariant.find({
        product: productId,
        isActive: true,
      })
        .sort({
          createdAt: 1,
        })
        .lean();

    return res.status(200).json({
      success: true,
      data: {
        variants,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET SINGLE VARIANT - PUBLIC
// ======================================================

const getVariantById = async (
  req,
  res,
  next
) => {
  try {
    const {
      productId,
      variantId,
    } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        productId
      ) ||
      !mongoose.Types.ObjectId.isValid(
        variantId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID",
      });
    }

    const variant =
      await ProductVariant.findOne({
        _id: variantId,
        product: productId,
        isActive: true,
      }).lean();

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        variant,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// CREATE VARIANT - ADMIN
// ======================================================

const createVariant = async (
  req,
  res,
  next
) => {
  try {
    const { productId } =
      req.params;

    const {
      name,
      price,
      compareAtPrice,
      stock,
      attributes,
    } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(
        productId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    if (!name || price === undefined) {
      return res.status(400).json({
        success: false,
        message:
          "Variant name and price are required",
      });
    }

    const product =
      await Product.findById(
        productId
      );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot add variant to an inactive product",
      });
    }

    const variantPrice =
      Number(price);

    if (
      Number.isNaN(variantPrice) ||
      variantPrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid variant price",
      });
    }

    let variantComparePrice = null;

    if (
      compareAtPrice !== undefined &&
      compareAtPrice !== null
    ) {
      variantComparePrice =
        Number(compareAtPrice);

      if (
        Number.isNaN(
          variantComparePrice
        ) ||
        variantComparePrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid compare price",
        });
      }

      if (
        variantComparePrice <
        variantPrice
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Compare price must be greater than or equal to variant price",
        });
      }
    }

    const variantStock =
      stock === undefined
        ? 0
        : Number(stock);

    if (
      Number.isNaN(variantStock) ||
      variantStock < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid stock value",
      });
    }

    const variant =
      await ProductVariant.create({
        product: productId,
        name: name.trim(),
        price: variantPrice,
        compareAtPrice:
          variantComparePrice,
        stock: variantStock,
        attributes:
          attributes || {},
      });

    // Mark product as having variants
    product.hasVariants = true;

    await product.save();

    return res.status(201).json({
      success: true,
      message:
        "Product variant created successfully",
      data: {
        variant,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE VARIANT - ADMIN
// ======================================================

const updateVariant = async (
  req,
  res,
  next
) => {
  try {
    const {
      productId,
      variantId,
    } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        productId
      ) ||
      !mongoose.Types.ObjectId.isValid(
        variantId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID",
      });
    }

    const variant =
      await ProductVariant.findOne({
        _id: variantId,
        product: productId,
      });

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    const {
      name,
      price,
      compareAtPrice,
      stock,
      attributes,
    } = req.body;

    if (name !== undefined) {
      variant.name =
        name.trim();
    }

    if (price !== undefined) {
      const newPrice =
        Number(price);

      if (
        Number.isNaN(newPrice) ||
        newPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid variant price",
        });
      }

      variant.price = newPrice;
    }

    if (
      compareAtPrice !== undefined
    ) {
      if (
        compareAtPrice === null
      ) {
        variant.compareAtPrice =
          null;
      } else {
        const newComparePrice =
          Number(compareAtPrice);

        if (
          Number.isNaN(
            newComparePrice
          ) ||
          newComparePrice < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid compare price",
          });
        }

        variant.compareAtPrice =
          newComparePrice;
      }
    }

    if (stock !== undefined) {
      const newStock =
        Number(stock);

      if (
        Number.isNaN(newStock) ||
        newStock < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid stock value",
        });
      }

      variant.stock =
        newStock;
    }

    if (attributes !== undefined) {
      variant.attributes =
        attributes;
    }

    await variant.save();

    return res.status(200).json({
      success: true,
      message:
        "Product variant updated successfully",
      data: {
        variant,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE VARIANT STATUS - ADMIN
// ======================================================

const updateVariantStatus =
  async (
    req,
    res,
    next
  ) => {
    try {
      const {
        productId,
        variantId,
      } = req.params;

      const {
        isActive,
      } = req.body;

      if (
        typeof isActive !==
        "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "isActive must be true or false",
        });
      }

      const variant =
        await ProductVariant.findOneAndUpdate(
          {
            _id: variantId,
            product: productId,
          },
          {
            isActive,
          },
          {
            new: true,
            runValidators: true,
          }
        );

      if (!variant) {
        return res.status(404).json({
          success: false,
          message:
            "Variant not found",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Variant status updated successfully",
        data: {
          variant,
        },
      });
    } catch (error) {
      next(error);
    }
  };

// ======================================================
// DELETE VARIANT - ADMIN
// ======================================================

const deleteVariant = async (
  req,
  res,
  next
) => {
  try {
    const {
      productId,
      variantId,
    } = req.params;

    const variant =
      await ProductVariant.findOne({
        _id: variantId,
        product: productId,
      });

    if (!variant) {
      return res.status(404).json({
        success: false,
        message:
          "Variant not found",
      });
    }

    // Soft delete
    variant.isActive = false;

    await variant.save();

    // Check remaining active variants
    const remainingVariants =
      await ProductVariant.countDocuments(
        {
          product: productId,
          isActive: true,
        }
      );

    if (remainingVariants === 0) {
      await Product.findByIdAndUpdate(
        productId,
        {
          hasVariants: false,
        }
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Product variant deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProductVariants,
  getVariantById,
  createVariant,
  updateVariant,
  updateVariantStatus,
  deleteVariant,
};