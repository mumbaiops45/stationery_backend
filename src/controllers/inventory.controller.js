const mongoose = require("mongoose");

const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");

// ======================================================
// GET ALL INVENTORY
// ======================================================

// ======================================================
// GET ALL INVENTORY
// Search + Stock Filter + Pagination
// ======================================================

const getInventory = async (
  req,
  res,
  next
) => {
  try {
    const {
      search = "",
      stockStatus = "all",
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
    // SEARCH
    // --------------------------------------------------

    const searchText = search.trim();

    const productFilter = {};

    if (searchText) {
      productFilter.name = {
        $regex: searchText,
        $options: "i",
      };
    }

    // --------------------------------------------------
    // STOCK FILTER
    //
    // 0       = out_of_stock
    // 1 - 10  = low_stock
    // > 10    = in_stock
    // --------------------------------------------------

    if (stockStatus === "out_of_stock") {
      productFilter.stock = 0;
    }

    if (stockStatus === "low_stock") {
      productFilter.stock = {
        $gt: 0,
        $lte: 10,
      };
    }

    if (stockStatus === "in_stock") {
      productFilter.stock = {
        $gt: 10,
      };
    }

    // --------------------------------------------------
    // PRODUCTS
    // --------------------------------------------------

    const [
      products,
      totalProducts,
    ] = await Promise.all([
      Product.find(productFilter)
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
        .skip(skip)
        .limit(perPage)
        .lean(),

      Product.countDocuments(
        productFilter
      ),
    ]);

    // --------------------------------------------------
    // VARIANTS
    //
    // Variants are returned separately because
    // ProductVariant has its own stock.
    // --------------------------------------------------

    const variantFilter = {};

    if (searchText) {
      variantFilter.name = {
        $regex: searchText,
        $options: "i",
      };
    }

    if (
      stockStatus ===
      "out_of_stock"
    ) {
      variantFilter.stock = 0;
    }

    if (
      stockStatus ===
      "low_stock"
    ) {
      variantFilter.stock = {
        $gt: 0,
        $lte: 10,
      };
    }

    if (
      stockStatus ===
      "in_stock"
    ) {
      variantFilter.stock = {
        $gt: 10,
      };
    }

    const [
      variants,
      totalVariants,
    ] = await Promise.all([
      ProductVariant.find(
        variantFilter
      )
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
        .skip(skip)
        .limit(perPage)
        .lean(),

      ProductVariant.countDocuments(
        variantFilter
      ),
    ]);

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      data: {
        products,
        variants,

        pagination: {
          page: currentPage,
          limit: perPage,

          products: {
            total:
              totalProducts,

            totalPages:
              Math.ceil(
                totalProducts /
                  perPage
              ),
          },

          variants: {
            total:
              totalVariants,

            totalPages:
              Math.ceil(
                totalVariants /
                  perPage
              ),
          },
        },

        filters: {
          search: searchText,
          stockStatus,
        },
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