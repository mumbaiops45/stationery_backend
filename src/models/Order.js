const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
    },

    productImage: {
      type: String,
      default: null,
    },

    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },

    variantName: {
      type: String,
      default: null,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    itemTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: true,
  }
);

const shippingAddressSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
      },

      phone: {
        type: String,
        required: true,
      },

      addressLine1: {
        type: String,
        required: true,
      },

      addressLine2: {
        type: String,
        default: "",
      },

      city: {
        type: String,
        required: true,
      },

      state: {
        type: String,
        required: true,
      },

      postalCode: {
        type: String,
        required: true,
      },

      country: {
        type: String,
        required: true,
        default: "India",
      },
    },
    {
      _id: false,
    }
  );

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: function (items) {
          return items.length > 0;
        },
        message:
          "Order must contain at least one item",
      },
    },

    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    shipping: {
      type: Number,
      required: true,
      min: 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
    },

    razorpayOrderId: {
      type: String,
      required: true,
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      required: true,
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: [
        "captured",
        "failed",
        "refunded",
      ],
      default: "captured",
      index: true,
    },

    orderStatus: {
      type: String,
      enum: [
        "confirmed",
        "processing",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      default: "confirmed",
      index: true,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({
  user: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "Order",
  orderSchema
);