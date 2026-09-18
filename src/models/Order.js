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

    // Free gift the customer picked after crossing the free-gift
    // threshold. Not a real order item - price 0, stock untouched,
    // admin packs it in manually. Null when no gift was chosen.
    giftProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    giftProductName: {
      type: String,
      default: "",
      trim: true,
    },

    giftProductImage: {
      type: String,
      default: "",
      trim: true,
    },

    // How the customer chose to pay. Online (Razorpay) only -
    // cash on delivery is not offered.
    paymentMethod: {
      type: String,
      enum: ["online"],
      default: "online",
      required: true,
      index: true,
    },

    // Razorpay fields below are all populated once verified,
    // which is why none of them are required.
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    razorpayOrderId: {
      type: String,
      default: null,
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "captured",
        "failed",
        "refunded",
      ],
      default: "captured",
      index: true,
    },

    // Stamped when payment is verified.
    paidAt: {
      type: Date,
      default: null,
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

    // Pushed to Shiprocket right after the order is created. Best-effort:
    // a failure here never blocks checkout, since the customer has already
    // paid. "status" lets the admin panel show what happened and retry.
    shiprocket: {
      shiprocketOrderId: {
        type: String,
        default: null,
      },
      shipmentId: {
        type: String,
        default: null,
      },
      awbCode: {
        type: String,
        default: null,
      },
      courierName: {
        type: String,
        default: null,
      },
      status: {
        type: String,
        enum: [
          "not_pushed",
          "created",
          "failed",
        ],
        default: "not_pushed",
      },
      error: {
        type: String,
        default: null,
      },
      pushedAt: {
        type: Date,
        default: null,
      },
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    // Picked from a fixed list so cancellations can be
    // grouped and reported on.
    cancelReasonCode: {
      type: String,
      enum: [
        "ordered_by_mistake",
        "found_better_price",
        "changed_mind",
        "wrong_item",
        "duplicate_order",
        "delivery_too_slow",
        "address_issue",
        "other",
        null,
      ],
      default: null,
      index: true,
    },

    // The customer's own words, or the label of the code
    // above when they did not add anything.
    cancelReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: [
        300,
        "Cancel reason cannot exceed 300 characters",
      ],
    },

    cancelledBy: {
      type: String,
      enum: ["customer", "admin", null],
      default: null,
    },

    // Set the moment stock is returned to inventory.
    // Guards against a second cancel restoring twice.
    stockRestoredAt: {
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