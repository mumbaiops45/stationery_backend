const mongoose = require("mongoose");

// ======================================================
// SETTING
//
// A single document holding store-wide values admin can
// edit without a redeploy - shipping today, more can join
// this shape later.
// ======================================================

const settingSchema = new mongoose.Schema(
  {
    // Flat delivery fee charged below the free-shipping threshold.
    shippingCharge: {
      type: Number,
      required: true,
      min: [0, "Shipping charge cannot be negative"],
      default: 50,
    },

    // Orders at or above this subtotal ship free.
    // Set to 0 to always charge shippingCharge.
    freeShippingThreshold: {
      type: Number,
      required: true,
      min: [
        0,
        "Free shipping threshold cannot be negative",
      ],
      default: 1000,
    },

    // Flat fee for expedited delivery. Not yet offered as a
    // choice at checkout - admin can price it in ahead of that
    // shipping-method-selection feature landing.
    expressShippingCharge: {
      type: Number,
      required: true,
      min: [
        0,
        "Express shipping charge cannot be negative",
      ],
      default: 150,
    },

    // Flat fee for same-day delivery. Same status as express:
    // priced, not yet selectable by the customer.
    sameDayDeliveryCharge: {
      type: Number,
      required: true,
      min: [
        0,
        "Same-day delivery charge cannot be negative",
      ],
      default: 250,
    },

    // Orders at or above this subtotal get a free gift attached
    // automatically - no picker, just this one fixed product.
    freeGiftThreshold: {
      type: Number,
      required: true,
      min: [
        0,
        "Free gift threshold cannot be negative",
      ],
      default: 500,
    },

    // The one product given away as the free gift. Null means no
    // gift is configured yet, so nothing is attached even once a
    // cart crosses freeGiftThreshold.
    freeGiftProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// One document for the whole store. Created lazily with
// schema defaults the first time it's read.
settingSchema.statics.getSingleton =
  async function () {
    let setting = await this.findOne();

    if (!setting) {
      setting = await this.create({});
    }

    return setting;
  };

module.exports = mongoose.model(
  "Setting",
  settingSchema
);
