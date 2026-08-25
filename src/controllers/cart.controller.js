const mongoose = require("mongoose");

const Cart = require("../models/Cart");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");

// ======================================================
// GET CART
// ======================================================

const getCart = async (
  req,
  res,
  next
) => {
  try {
    const userId =
      req.user.userId;

    const cart =
      await Cart.findOne({
        user: userId,
      })
        .populate({
          path: "items.product",
          populate: {
            path: "category",
            select: "name slug",
          },
        })
        .populate({
          path: "items.variant",
        })
        .lean();

    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          cart: {
            items: [],
            totalItems: 0,
            subtotal: 0,
          },
        },
      });
    }

    let totalItems = 0;
    let subtotal = 0;

    const items = cart.items
      .filter(
        (item) =>
          item.product &&
          item.product.isActive
      )
      .map((item) => {
        const product =
          item.product;

        const variant =
          item.variant;

        let price =
          product.price;

        if (
          product.hasVariants
        ) {
          if (
            !variant ||
            !variant.isActive
          ) {
            return null;
          }

          price =
            variant.price;
        }

        const itemTotal =
          price *
          item.quantity;

        totalItems +=
          item.quantity;

        subtotal +=
          itemTotal;

        return {
          id: item._id,
          product,
          variant,
          quantity:
            item.quantity,
          price,
          itemTotal,
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      data: {
        cart: {
          id: cart._id,
          items,
          totalItems,
          subtotal,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// ADD TO CART
// ======================================================

const addToCart = async (
  req,
  res,
  next
) => {
  try {
    const userId =
      req.user.userId;

    const {
      productId,
      variantId,
      quantity = 1,
    } = req.body;

    // --------------------------------------------------
    // VALIDATE PRODUCT ID
    // --------------------------------------------------

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

    // --------------------------------------------------
    // VALIDATE QUANTITY
    // --------------------------------------------------

    const requestedQuantity =
      Number(quantity);

    if (
      !Number.isInteger(
        requestedQuantity
      ) ||
      requestedQuantity < 1
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Quantity must be a positive integer",
      });
    }

    // --------------------------------------------------
    // FIND PRODUCT
    // --------------------------------------------------

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

    let variant = null;

    // --------------------------------------------------
    // VARIANT PRODUCT
    // --------------------------------------------------

    if (product.hasVariants) {
      if (!variantId) {
        return res.status(400).json({
          success: false,
          message:
            "Variant is required for this product",
        });
      }

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

      variant =
        await ProductVariant.findOne({
          _id: variantId,
          product: productId,
          isActive: true,
        });

      if (!variant) {
        return res.status(404).json({
          success: false,
          message:
            "Product variant not found",
        });
      }

      if (
        variant.stock <
        requestedQuantity
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Only ${variant.stock} units available`,
        });
      }
    }

    // --------------------------------------------------
    // SIMPLE PRODUCT
    // --------------------------------------------------

    if (!product.hasVariants) {
      if (variantId) {
        return res.status(400).json({
          success: false,
          message:
            "This product does not have variants",
        });
      }

      if (
        product.stock <
        requestedQuantity
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Only ${product.stock} units available`,
        });
      }
    }

    // --------------------------------------------------
    // FIND OR CREATE CART
    // --------------------------------------------------

    let cart =
      await Cart.findOne({
        user: userId,
      });

    if (!cart) {
      cart =
        await Cart.create({
          user: userId,
          items: [
            {
              product: productId,
              variant:
                variantId || null,
              quantity:
                requestedQuantity,
            },
          ],
        });

      return res.status(201).json({
        success: true,
        message:
          "Product added to cart",
      });
    }

    // --------------------------------------------------
    // CHECK EXISTING ITEM
    // --------------------------------------------------

    const existingItem =
      cart.items.find(
        (item) => {
          const sameProduct =
            item.product.toString() ===
            productId;

          const existingVariant =
            item.variant
              ? item.variant.toString()
              : null;

          const newVariant =
            variantId || null;

          return (
            sameProduct &&
            existingVariant ===
              newVariant
          );
        }
      );

    if (existingItem) {
      const newQuantity =
        existingItem.quantity +
        requestedQuantity;

      const availableStock =
        product.hasVariants
          ? variant.stock
          : product.stock;

      if (
        newQuantity >
        availableStock
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Only ${availableStock} units available`,
        });
      }

      existingItem.quantity =
        newQuantity;
    } else {
      cart.items.push({
        product: productId,
        variant:
          variantId || null,
        quantity:
          requestedQuantity,
      });
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message:
        "Product added to cart",
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE CART ITEM QUANTITY
// ======================================================

const updateCartItem = async (
  req,
  res,
  next
) => {
  try {
    const userId =
      req.user.userId;

    const { itemId } =
      req.params;

    const {
      quantity,
    } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(
        itemId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid cart item ID",
      });
    }

    const newQuantity =
      Number(quantity);

    if (
      !Number.isInteger(
        newQuantity
      ) ||
      newQuantity < 1
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Quantity must be a positive integer",
      });
    }

    const cart =
      await Cart.findOne({
        user: userId,
      });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item =
      cart.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message:
          "Cart item not found",
      });
    }

    const product =
      await Product.findOne({
        _id: item.product,
        isActive: true,
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product is no longer available",
      });
    }

    let availableStock =
      product.stock;

    if (item.variant) {
      const variant =
        await ProductVariant.findOne(
          {
            _id: item.variant,
            product: product._id,
            isActive: true,
          }
        );

      if (!variant) {
        return res.status(404).json({
          success: false,
          message:
            "Product variant is no longer available",
        });
      }

      availableStock =
        variant.stock;
    }

    if (
      newQuantity >
      availableStock
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Only ${availableStock} units available`,
      });
    }

    item.quantity =
      newQuantity;

    await cart.save();

    return res.status(200).json({
      success: true,
      message:
        "Cart quantity updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// REMOVE CART ITEM
// ======================================================

const removeCartItem = async (
  req,
  res,
  next
) => {
  try {
    const userId =
      req.user.userId;

    const { itemId } =
      req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        itemId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid cart item ID",
      });
    }

    const cart =
      await Cart.findOne({
        user: userId,
      });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item =
      cart.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message:
          "Cart item not found",
      });
    }

    item.deleteOne();

    await cart.save();

    return res.status(200).json({
      success: true,
      message:
        "Item removed from cart",
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// CLEAR CART
// ======================================================

const clearCart = async (
  req,
  res,
  next
) => {
  try {
    const userId =
      req.user.userId;

    const cart =
      await Cart.findOne({
        user: userId,
      });

    if (!cart) {
      return res.status(200).json({
        success: true,
        message:
          "Cart is already empty",
      });
    }

    cart.items = [];

    await cart.save();

    return res.status(200).json({
      success: true,
      message:
        "Cart cleared successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};