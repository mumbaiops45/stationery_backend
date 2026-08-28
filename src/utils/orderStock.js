const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");

// ======================================================
// ORDER STATUS RULES
//
// Stock leaves inventory in payment/verify. It comes back
// only here, and only once per order.
// ======================================================

const ORDER_STATUSES = [
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

// What an order in a given state is allowed to become.
// Anything not listed is rejected, so an order can never
// move backwards or leave a terminal state.
const ALLOWED_TRANSITIONS = {
  confirmed: [
    "processing",
    "shipped",
    "cancelled",
  ],

  processing: [
    "shipped",
    "cancelled",
  ],

  shipped: [
    "out_for_delivery",
    "delivered",
    "cancelled",
  ],

  out_for_delivery: [
    "delivered",
    "cancelled",
  ],

  // Terminal
  delivered: [],
  cancelled: [],
};

// A customer may only pull the plug before the parcel
// has left. After that it is a support/returns matter.
const CUSTOMER_CANCELLABLE = [
  "confirmed",
  "processing",
];

const canTransition = (
  from,
  to
) =>
  Boolean(
    ALLOWED_TRANSITIONS[from]?.includes(
      to
    )
  );

// ======================================================
// RESTORE STOCK
//
// Puts every line item back. Idempotent: an order that
// already has stockRestoredAt set is left alone, so a
// double cancel cannot inflate inventory.
// ======================================================

const restoreOrderStock = async (
  order,
  session
) => {
  if (order.stockRestoredAt) {
    return false;
  }

  for (const item of order.items) {
    if (item.variant) {
      await ProductVariant.updateOne(
        {
          _id: item.variant,
        },
        {
          $inc: {
            stock: item.quantity,
          },
        },
        {
          session,
        }
      );

      continue;
    }

    await Product.updateOne(
      {
        _id: item.product,
      },
      {
        $inc: {
          stock: item.quantity,
        },
      },
      {
        session,
      }
    );
  }

  order.stockRestoredAt =
    new Date();

  return true;
};

// ======================================================
// CANCELLATION REASONS
//
// A fixed list rather than free text, so "why do people
// cancel" is a question the reports can actually answer.
// The storefront renders these as a dropdown.
// ======================================================

const CANCEL_REASONS = [
  {
    code: "ordered_by_mistake",
    label:
      "I ordered this by mistake",
  },
  {
    code: "found_better_price",
    label:
      "I found a better price elsewhere",
  },
  {
    code: "changed_mind",
    label:
      "I changed my mind",
  },
  {
    code: "wrong_item",
    label:
      "I ordered the wrong item",
  },
  {
    code: "duplicate_order",
    label:
      "I placed this order twice",
  },
  {
    code: "delivery_too_slow",
    label:
      "Delivery is taking too long",
  },
  {
    code: "address_issue",
    label:
      "I need to change the delivery address",
  },
  {
    code: "other",
    label: "Something else",
  },
];

const CANCEL_REASON_CODES =
  CANCEL_REASONS.map(
    (r) => r.code
  );

const cancelReasonLabel = (
  code
) =>
  CANCEL_REASONS.find(
    (r) => r.code === code
  )?.label || null;

// ======================================================
// COD AVAILABILITY
//
// Cash on delivery carries real risk (refused parcels),
// so it can be switched off or capped without a redeploy.
// ======================================================

const isCodEnabled = () =>
  process.env.COD_ENABLED !==
  "false";

const getCodMaxOrderValue = () => {
  const raw = Number(
    process.env
      .COD_MAX_ORDER_VALUE
  );

  return Number.isFinite(raw) &&
    raw > 0
    ? raw
    : null;
};

// Returns null when COD is allowed, or the reason it is not.
const codRejectionReason = (
  total
) => {
  if (!isCodEnabled()) {
    return "Cash on delivery is currently unavailable";
  }

  const max =
    getCodMaxOrderValue();

  if (max && total > max) {
    return `Cash on delivery is only available on orders up to ₹${max}`;
  }

  return null;
};

// ======================================================
// DEDUCT STOCK FOR A CART
//
// Builds the order line items and takes the stock in one
// pass. Each deduction is a conditional update, so two
// shoppers racing for the last unit cannot both win.
//
// Throws on any problem: the caller runs this inside a
// transaction and aborts.
// ======================================================

const deductStockForCart = async (
  cart,
  session
) => {
  const Product = require("../models/Product");
  const ProductVariant = require("../models/ProductVariant");

  const orderItems = [];

  let subtotal = 0;

  for (const cartItem of cart.items) {
    const product =
      await Product.findOne({
        _id: cartItem.product,
        isActive: true,
      }).session(session);

    if (!product) {
      throw new Error(
        "A product in your cart is no longer available"
      );
    }

    let price = product.price;
    let variant = null;

    if (product.hasVariants) {
      if (!cartItem.variant) {
        throw new Error(
          `${product.name} requires a variant`
        );
      }

      variant =
        await ProductVariant.findOne({
          _id: cartItem.variant,
          product: product._id,
          isActive: true,
        }).session(session);

      if (!variant) {
        throw new Error(
          `${product.name} variant is no longer available`
        );
      }

      const updatedVariant =
        await ProductVariant.findOneAndUpdate(
          {
            _id: variant._id,
            stock: {
              $gte:
                cartItem.quantity,
            },
          },
          {
            $inc: {
              stock:
                -cartItem.quantity,
            },
          },
          {
            new: true,
            session,
          }
        );

      if (!updatedVariant) {
        throw new Error(
          `Insufficient stock for ${product.name}`
        );
      }

      price =
        updatedVariant.price;
    } else {
      const updatedProduct =
        await Product.findOneAndUpdate(
          {
            _id: product._id,
            stock: {
              $gte:
                cartItem.quantity,
            },
          },
          {
            $inc: {
              stock:
                -cartItem.quantity,
            },
          },
          {
            new: true,
            session,
          }
        );

      if (!updatedProduct) {
        throw new Error(
          `Insufficient stock for ${product.name}`
        );
      }

      price =
        updatedProduct.price;
    }

    const itemTotal =
      price * cartItem.quantity;

    subtotal += itemTotal;

    orderItems.push({
      product: product._id,

      productName: product.name,

      productImage:
        product.image?.url || null,

      variant: variant
        ? variant._id
        : null,

      variantName: variant
        ? variant.name
        : null,

      quantity:
        cartItem.quantity,

      price,

      itemTotal,
    });
  }

  return {
    orderItems,
    subtotal,
  };
};

// ======================================================
// TOTALS
//
// One place, so checkout, COD and Razorpay can never
// quote different numbers for the same cart.
// ======================================================

const FREE_SHIPPING_THRESHOLD = 500;
const SHIPPING_FLAT = 50;

const calculateTotals = (
  subtotal
) => {
  const shipping =
    subtotal >=
    FREE_SHIPPING_THRESHOLD
      ? 0
      : SHIPPING_FLAT;

  return {
    subtotal,
    shipping,
    total: subtotal + shipping,
  };
};

module.exports = {
  ORDER_STATUSES,
  CANCEL_REASONS,
  CANCEL_REASON_CODES,
  cancelReasonLabel,
  ALLOWED_TRANSITIONS,
  CUSTOMER_CANCELLABLE,
  canTransition,
  restoreOrderStock,
  deductStockForCart,
  calculateTotals,
  isCodEnabled,
  getCodMaxOrderValue,
  codRejectionReason,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FLAT,
};

