const mongoose = require("mongoose");

const productVariantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Variant name is required"],
      trim: true,
      maxlength: [200, "Variant name cannot exceed 200 characters"],
    },

    price: {
      type: Number,
      required: [true, "Variant price is required"],
      min: [0, "Price cannot be negative"],
    },

    compareAtPrice: {
      type: Number,
      default: null,
      min: [0, "Compare price cannot be negative"],
    },

    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },

    attributes: {
      type: Map,
      of: String,
      default: {},
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

productVariantSchema.index({
  product: 1,
  isActive: 1,
});

module.exports = mongoose.model(
  "ProductVariant",
  productVariantSchema
);