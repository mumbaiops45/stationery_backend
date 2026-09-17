const mongoose = require("mongoose");

// ======================================================
// BANNER
//
// Backs two placements via the `type` field:
//  - "homepage": main hero banner. Only image + description
//    + discount are used; title/link/buttonText stay empty.
//  - "offer": promo banner. Uses the full field set -
//    title, description, discount, image, link, buttonText.
// ======================================================

const bannerSchema = new mongoose.Schema(
  {
    // Mainly used by offer banners. Left blank for homepage banners.
    title: {
      type: String,
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters"],
      default: "",
    },

    description: {
      type: String,
      trim: true,
      maxlength: [250, "Description cannot exceed 250 characters"],
      default: "",
    },

    // Discount label shown on the banner, e.g. "Flat 30% OFF"
    discount: {
      type: String,
      trim: true,
      maxlength: [50, "Discount text cannot exceed 50 characters"],
      default: "",
    },

    image: {
      url: {
        type: String,
        required: [true, "Banner image is required"],
        trim: true,
      },

      // Cloudinary public_id, kept so the asset can be
      // deleted when the image is replaced or removed.
      publicId: {
        type: String,
        default: "",
        trim: true,
      },
    },

    // Where the banner should navigate to when clicked.
    // Mainly used by offer banners, e.g. "/products/notebooks".
    link: {
      type: String,
      trim: true,
      default: "",
    },

    // Mainly used by offer banners.
    buttonText: {
      type: String,
      trim: true,
      maxlength: [50, "Button text cannot exceed 50 characters"],
      default: "",
    },

    // "homepage" = main hero/carousel banner, "offer" = promo/offer banner
    type: {
      type: String,
      enum: ["homepage", "offer"],
      default: "homepage",
      index: true,
    },

    // Lower position = shown earlier in the carousel/list
    position: {
      type: Number,
      default: 0,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Scheduling window. null means "no boundary" on that side,
    // so the banner is shown immediately / never expires.
    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

bannerSchema.index({ type: 1, isActive: 1, position: 1 });

module.exports = mongoose.model(
  "Banner",
  bannerSchema
);
