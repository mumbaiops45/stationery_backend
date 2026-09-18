const mongoose = require("mongoose");
const Setting = require("../models/Setting");
const Product = require("../models/Product");

// Every shipping field is a plain "number >= 0", so the check is
// written once here instead of four times over.
const SHIPPING_FIELDS = [
  "shippingCharge",
  "freeShippingThreshold",
  "expressShippingCharge",
  "sameDayDeliveryCharge",
];

const shippingResponseData = (
  setting
) => ({
  shippingCharge:
    setting.shippingCharge,
  freeShippingThreshold:
    setting.freeShippingThreshold,
  expressShippingCharge:
    setting.expressShippingCharge,
  sameDayDeliveryCharge:
    setting.sameDayDeliveryCharge,
});

// ======================================================
// GET SHIPPING SETTINGS
//
// Same handler backs both the admin route (protect +
// adminOnly) and the public route the storefront reads
// before checkout - nothing returned here is sensitive.
// ======================================================

const getShippingSettings = async (
  req,
  res,
  next
) => {
  try {
    const setting =
      await Setting.getSingleton();

    return res.status(200).json({
      success: true,
      data: shippingResponseData(
        setting
      ),
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE SHIPPING SETTINGS - ADMIN
//
// Default shipping and the free-shipping threshold are what
// checkout actually charges (see utils/orderStock.js). Express
// and same-day are priced here too, ready for a future "choose
// your delivery speed" step at checkout, but nothing selects
// them yet.
// ======================================================

const updateShippingSettings = async (
  req,
  res,
  next
) => {
  try {
    const body = req.body || {};

    const provided =
      SHIPPING_FIELDS.filter(
        (field) =>
          body[field] !== undefined
      );

    if (provided.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          `Provide at least one of: ${SHIPPING_FIELDS.join(", ")}`,
      });
    }

    const values = {};

    for (const field of provided) {
      const value = Number(
        body[field]
      );

      if (
        Number.isNaN(value) ||
        value < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `${field} must be a number >= 0`,
        });
      }

      values[field] = value;
    }

    const setting =
      await Setting.getSingleton();

    Object.assign(
      setting,
      values
    );

    await setting.save();

    return res.status(200).json({
      success: true,
      message:
        "Shipping settings updated successfully",
      data: shippingResponseData(
        setting
      ),
    });
  } catch (error) {
    next(error);
  }
};

// A populated product doc -> the small shape the admin UI needs to
// show "currently: <name>". Null when nothing is configured yet.
const giftProductSummary = (
  product
) =>
  product
    ? {
        id: product._id,
        name: product.name,
        image: product.image?.url || "",
      }
    : null;

// ======================================================
// GET FREE GIFT SETTINGS - ADMIN
// ======================================================

const getGiftSettings = async (
  req,
  res,
  next
) => {
  try {
    const setting = await (
      await Setting.getSingleton()
    ).populate(
      "freeGiftProduct",
      "name image"
    );

    return res.status(200).json({
      success: true,
      data: {
        freeGiftThreshold:
          setting.freeGiftThreshold,
        freeGiftProduct:
          giftProductSummary(
            setting.freeGiftProduct
          ),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE FREE GIFT SETTINGS - ADMIN
//
// The gift is one fixed product, not a picker the customer
// chooses from - simpler to run, and there is never a "the
// gift I wanted sold out mid-checkout" case to handle.
// ======================================================

const updateGiftSettings = async (
  req,
  res,
  next
) => {
  try {
    const {
      freeGiftThreshold,
      freeGiftProductId,
    } = req.body || {};

    if (
      freeGiftThreshold ===
        undefined &&
      freeGiftProductId === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Provide freeGiftThreshold and/or freeGiftProductId",
      });
    }

    let thresholdValue;

    if (
      freeGiftThreshold !== undefined
    ) {
      thresholdValue = Number(
        freeGiftThreshold
      );

      if (
        Number.isNaN(
          thresholdValue
        ) ||
        thresholdValue < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "freeGiftThreshold must be a number >= 0",
        });
      }
    }

    let productValue;

    if (
      freeGiftProductId !== undefined
    ) {
      // Empty string / null clears the gift - no product means no
      // free gift is attached, even past the threshold.
      if (!freeGiftProductId) {
        productValue = null;
      } else {
        if (
          !mongoose.Types.ObjectId.isValid(
            freeGiftProductId
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid freeGiftProductId",
          });
        }

        const product =
          await Product.findOne({
            _id: freeGiftProductId,
            isActive: true,
          }).lean();

        if (!product) {
          return res.status(400).json({
            success: false,
            message:
              "Selected product was not found or is inactive",
          });
        }

        productValue = product._id;
      }
    }

    const setting =
      await Setting.getSingleton();

    if (thresholdValue !== undefined) {
      setting.freeGiftThreshold =
        thresholdValue;
    }

    if (productValue !== undefined) {
      setting.freeGiftProduct =
        productValue;
    }

    await setting.save();
    await setting.populate(
      "freeGiftProduct",
      "name image"
    );

    return res.status(200).json({
      success: true,
      message:
        "Free gift settings updated successfully",
      data: {
        freeGiftThreshold:
          setting.freeGiftThreshold,
        freeGiftProduct:
          giftProductSummary(
            setting.freeGiftProduct
          ),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getShippingSettings,
  updateShippingSettings,
  getGiftSettings,
  updateGiftSettings,
};
