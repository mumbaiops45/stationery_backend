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

module.exports = {
  ORDER_STATUSES,
  ALLOWED_TRANSITIONS,
  CUSTOMER_CANCELLABLE,
  canTransition,
  restoreOrderStock,
};
