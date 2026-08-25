const mongoose = require("mongoose");

const Cart = require("../models/Cart");
const Address = require("../models/Address");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");

// ======================================================
// CHECKOUT PREVIEW
// ======================================================

const getCheckout = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { addressId } = req.body;

    // --------------------------------------------------
    // Validate address ID
    // --------------------------------------------------

    if (
      !addressId ||
      !mongoose.Types.ObjectId.isValid(addressId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid address ID is required",
      });
    }

    // --------------------------------------------------
    // Get cart
    // --------------------------------------------------

    const cart = await Cart.findOne({
      user: userId,
    }).lean();

    if (!cart || !cart.items.length) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty",
      });
    }

    // --------------------------------------------------
    // Get user's address
    // --------------------------------------------------

    const address = await Address.findOne({
      _id: addressId,
      user: userId,
    }).lean();

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // --------------------------------------------------
    // Validate cart items
    // --------------------------------------------------

    const checkoutItems = [];

    let subtotal = 0;

    for (const cartItem of cart.items) {
      const product = await Product.findOne({
        _id: cartItem.product,
        isActive: true,
      }).lean();

      if (!product) {
        return res.status(400).json({
          success: false,
          message:
            "One or more products in your cart are no longer available",
        });
      }

      let price = product.price;
      let stock = product.stock;
      let variant = null;

      // ------------------------------------------------
      // Variant product
      // ------------------------------------------------

      if (product.hasVariants) {
        if (!cartItem.variant) {
          return res.status(400).json({
            success: false,
            message:
              `${product.name} requires a variant`,
          });
        }

        variant = await ProductVariant.findOne({
          _id: cartItem.variant,
          product: product._id,
          isActive: true,
        }).lean();

        if (!variant) {
          return res.status(400).json({
            success: false,
            message:
              `Variant for ${product.name} is no longer available`,
          });
        }

        price = variant.price;
        stock = variant.stock;
      }

      // ------------------------------------------------
      // Stock validation
      // ------------------------------------------------

      if (stock < cartItem.quantity) {
        return res.status(400).json({
          success: false,
          message:
            `${product.name} has only ${stock} units available`,
        });
      }

      const itemTotal =
        price * cartItem.quantity;

      subtotal += itemTotal;

      checkoutItems.push({
        product: product._id,
        productName: product.name,

        variant: variant
          ? variant._id
          : null,

        variantName: variant
          ? variant.name
          : null,

        quantity: cartItem.quantity,

        price,

        itemTotal,
      });
    }

    // --------------------------------------------------
    // Shipping
    // --------------------------------------------------

    // For now:
    // Free shipping above ₹500
    // ₹50 otherwise

    const shipping =
      subtotal >= 500
        ? 0
        : 50;

    const total =
      subtotal + shipping;

    // --------------------------------------------------
    // Response
    // --------------------------------------------------

    return res.status(200).json({
      success: true,
      data: {
        checkout: {
          items: checkoutItems,

          address: {
            id: address._id,
            name: address.name,
            phone: address.phone,
            addressLine1:
              address.addressLine1,
            addressLine2:
              address.addressLine2,
            city: address.city,
            state: address.state,
            postalCode:
              address.postalCode,
            country: address.country,
          },

          pricing: {
            subtotal,
            shipping,
            total,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCheckout,
};